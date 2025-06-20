console.log('Interview Assistant renderer loaded');

// DOM elements
const transcriptionArea = document.getElementById('transcription') as HTMLDivElement;
const responseArea = document.getElementById('response') as HTMLDivElement;
const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLSpanElement;
const envStatusElement = document.getElementById('envStatus') as HTMLSpanElement;
const selectionBtn = document.getElementById('selectionBtn') as HTMLButtonElement;
const manualInput = document.getElementById('manualInput') as HTMLTextAreaElement;
const manualSubmitBtn = document.getElementById('manualSubmitBtn') as HTMLButtonElement;
const audioDeviceSelect = document.getElementById('audioDevice') as HTMLSelectElement;

// Mock interview data
const mockTranscription = `面接官: 本日はお忙しい中お時間をいただき、ありがとうございます。まず自己紹介をお願いします。

応募者: はい、○○と申します。大学では情報工学を専攻し、卒業後は前職でWebアプリケーションの開発に3年間従事してまいりました。

面接官: ありがとうございます。前職ではどのような技術スタックを使用されていましたか？

応募者: 主にReactとNode.jsを使用したフルスタック開発を担当しておりました。データベースはPostgreSQLを使用し、AWSでのデプロイ経験もございます。

面接官: 素晴らしいですね。では、あなたが今まで開発した中で最も印象に残っているプロジェクトについて教えてください。`;

const mockResponse = `この質問は「最も印象に残っているプロジェクト」について聞いているので、以下の要素を含めて回答することをお勧めします：

• プロジェクト概要（何を開発したか）
• 使用した技術スタック
• あなたの役割と責任
• 直面した課題とその解決方法
• 学んだことや成果

例：
「ECサイトのリニューアルプロジェクトが最も印象に残っています。React + TypeScriptでフロントエンドを再構築し、パフォーマンス改善を担当しました。特にページ読み込み速度を40%向上させることができ、ユーザー体験の大幅な改善につながりました。」`;

// Audio capture state
let isRecording = false;
let audioChunks: Buffer[] = [];
let realTimeTranscription = '';

// Text selection state
let selectedText = '';
let isButtonVisible = false;

// Initialize the app
function init(): void {
    console.log('Initializing Interview Assistant...');
    
    // Display mock data
    displayTranscription(mockTranscription);
    displayResponse(mockResponse);
    
    // Enable text selection functionality
    enableTextSelection();
    
    // Setup audio capture controls
    setupAudioControls();
    
    // Setup selection button
    setupSelectionButton();
    
    // Setup manual input
    setupManualInput();
    
    // Setup IPC listeners
    setupIPCListeners();
    
    // Check environment and transcription status
    checkEnvironmentStatus();
}

function setupAudioControls(): void {
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
}

function setupSelectionButton(): void {
    // Hide button initially
    selectionBtn.style.display = 'none';
    
    // Button click handler
    selectionBtn.addEventListener('click', handleSelectionButtonClick);
}

function setupManualInput(): void {
    manualSubmitBtn.addEventListener('click', handleManualSubmit);
    
    // Enable Enter key to submit (with Ctrl/Cmd)
    manualInput.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            handleManualSubmit();
        }
    });
    
    // Hide button when clicking outside
    document.addEventListener('click', (event) => {
        if (!transcriptionArea.contains(event.target as Node) && 
            !selectionBtn.contains(event.target as Node)) {
            hideSelectionButton();
        }
    });
}

async function checkEnvironmentStatus(): Promise<void> {
    try {
        console.log('Checking environment status...');
        
        // Check .env file status
        const envResult = await window.electronAPI.checkEnvStatus();
        console.log('Env result:', envResult);
        updateEnvStatus(envResult.hasApiKey, envResult.message);
        
        // Wait a bit for the transcription service to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        console.error('Failed to check environment status:', error);
        updateEnvStatus(false, 'エラー: 環境チェックに失敗しました');
    }
}

function updateEnvStatus(hasApiKey: boolean, message: string): void {
    envStatusElement.textContent = message;
    envStatusElement.className = 'env-status';
    
    if (hasApiKey) {
        envStatusElement.classList.add('found');
    } else {
        envStatusElement.classList.add('not-found');
    }
}

async function startRecording(): Promise<void> {
    try {
        updateStatus('録音開始中...');
        const selectedDevice = audioDeviceSelect.value;
        console.log('Selected audio device:', selectedDevice);
        const result = await window.electronAPI.startAudioCapture(selectedDevice);
        
        if (result.success) {
            isRecording = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            audioDeviceSelect.disabled = true; // Disable device selection while recording
            updateStatus('録音中');
            realTimeTranscription = '';
            
            // Check if transcription is ready
            const isReady = await window.electronAPI.isTranscriptionReady();
            const deviceName = selectedDevice === 'default' ? 'デフォルトマイク' : selectedDevice;
            if (isReady) {
                transcriptionArea.textContent = `音声をキャプチャしています... (デバイス: ${deviceName})\n文字起こしを開始します（5秒間隔）`;
            } else {
                transcriptionArea.textContent = `音声をキャプチャしています... (デバイス: ${deviceName})\n.envファイルにAPIキーを設定すると文字起こしが開始されます。`;
            }
        } else {
            updateStatus('エラー: ' + result.error);
            console.error('Recording failed:', result.error);
        }
    } catch (error) {
        updateStatus('録音開始エラー');
        console.error('Start recording error:', error);
        audioDeviceSelect.disabled = false;
    }
}

async function stopRecording(): Promise<void> {
    try {
        updateStatus('録音停止中...');
        const result = await window.electronAPI.stopAudioCapture();
        
        if (result.success) {
            isRecording = false;
            startBtn.disabled = false;
            stopBtn.disabled = true;
            audioDeviceSelect.disabled = false; // Re-enable device selection
            updateStatus('待機中');
            transcriptionArea.textContent = mockTranscription;
        } else {
            updateStatus('エラー: ' + result.error);
            console.error('Stop recording failed:', result.error);
        }
    } catch (error) {
        updateStatus('録音停止エラー');
        console.error('Stop recording error:', error);
        audioDeviceSelect.disabled = false;
    }
}


function updateStatus(status: string): void {
    statusElement.textContent = status;
}


function setupIPCListeners(): void {
    window.electronAPI.onAudioCaptureStarted(() => {
        console.log('Audio capture started from main process');
        updateStatus('録音中');
    });
    
    window.electronAPI.onAudioCaptureStopped(() => {
        console.log('Audio capture stopped from main process');
        updateStatus('待機中');
    });
    
    window.electronAPI.onAudioData((event, data: Buffer) => {
        audioChunks.push(data);
        console.log('Received audio data chunk:', data.length, 'bytes');
    });
    
    window.electronAPI.onAudioCaptureError((event, error: string) => {
        console.error('Audio capture error from main process:', error);
        updateStatus('エラー: ' + error);
        isRecording = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        audioDeviceSelect.disabled = false;
    });

    window.electronAPI.onTranscriptionResult((event, text: string) => {
        console.log('Received transcription:', text);
        if (text.trim()) {
            realTimeTranscription += (realTimeTranscription ? '\n\n' : '') + text.trim();
            displayTranscription(realTimeTranscription);
        }
    });

    window.electronAPI.onTranscriptionError((event, error: string) => {
        console.error('Transcription error:', error);
    });
}

function displayTranscription(text: string): void {
    transcriptionArea.textContent = text;
}

function displayResponse(text: string): void {
    responseArea.textContent = text;
}

function enableTextSelection(): void {
    transcriptionArea.addEventListener('mouseup', handleTextSelection);
    transcriptionArea.addEventListener('keyup', handleTextSelection);
}

function handleTextSelection(): void {
    const selection = window.getSelection();
    const selectedTextContent = selection?.toString().trim();
    
    if (selectedTextContent && selectedTextContent.length > 10) {
        console.log('Selected text:', selectedTextContent);
        selectedText = selectedTextContent;
        showSelectionButton();
    } else {
        hideSelectionButton();
    }
}

function showSelectionButton(): void {
    if (isButtonVisible) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = transcriptionArea.getBoundingClientRect();
    const paneRect = transcriptionArea.closest('.pane')?.getBoundingClientRect();
    
    if (!paneRect) return;
    
    // Position button directly below the selected text (relative to pane)
    const buttonX = Math.max(5, Math.min(
        rect.left - paneRect.left,
        paneRect.width - 180 // Button width
    ));
    const buttonY = rect.bottom - paneRect.top + 8;
    
    selectionBtn.style.left = `${buttonX}px`;
    selectionBtn.style.top = `${buttonY}px`;
    selectionBtn.style.display = 'block';
    selectionBtn.classList.add('visible');
    
    isButtonVisible = true;
    console.log('Selection button shown for text:', selectedText.substring(0, 50) + '...');
}

function hideSelectionButton(clearSelection: boolean = true): void {
    if (!isButtonVisible) return;
    
    selectionBtn.classList.remove('visible');
    selectionBtn.style.display = 'none';
    isButtonVisible = false;
    
    if (clearSelection) {
        selectedText = '';
        // Clear any text selection
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }
    }
}

function handleSelectionButtonClick(): void {
    // Get current selection again to make sure we have the latest
    const selection = window.getSelection();
    const currentSelectedText = selection?.toString().trim() || selectedText;
    
    if (!currentSelectedText) {
        console.warn('No text selected');
        alert('テキストを選択してからボタンをクリックしてください');
        return;
    }
    
    console.log('Generating interview response for:', currentSelectedText);
    
    // Update UI to show processing
    responseArea.textContent = `選択されたテキスト:\n"${currentSelectedText}"\n\n面接回答を生成中...`;
    
    // Hide the selection button but keep the selection
    hideSelectionButton(false);
    
    // Generate interview response with current selection
    generateInterviewResponse(currentSelectedText, false);
}

async function handleManualSubmit(): Promise<void> {
    const inputText = manualInput.value.trim();
    
    if (!inputText) {
        alert('質問や面接内容を入力してください');
        manualInput.focus();
        return;
    }
    
    console.log('Manual input submitted:', inputText);
    
    // Disable button during processing
    manualSubmitBtn.disabled = true;
    manualSubmitBtn.textContent = '生成中...';
    
    try {
        // Generate response
        await generateInterviewResponse(inputText, true);
    } finally {
        // Re-enable button
        manualSubmitBtn.disabled = false;
        manualSubmitBtn.textContent = 'AI回答生成';
    }
}

async function generateInterviewResponse(text: string, isManualInput: boolean = false): Promise<void> {
    const sourceLabel = isManualInput ? '入力されたテキスト' : '選択されたテキスト';
    
    try {
        console.log('Generating interview response for:', text);
        
        // Show initial progress
        responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n🔄 面接アシスタントをチェック中...`;
        
        // Check if Interview Assistant is available
        const isAvailable = await window.electronAPI.checkInterviewAssistantAvailability();
        if (!isAvailable) {
            responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n❌ 面接アシスタントが利用できません\n\n.envファイルにOPENAI_API_KEYが設定されているか確認してください。`;
            return;
        }
        
        // Show sending progress
        responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n🚀 面接回答を生成中...\n(3-5秒程度かかります)`;
        
        // Send to Interview Assistant
        const result = await window.electronAPI.generateInterviewResponse(text);
        
        if (result.success && result.response) {
            responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n✅ 面接回答:\n\n${result.response}`;
            
            // Clear manual input if successful and was manual input
            if (isManualInput) {
                manualInput.value = '';
            }
        } else {
            responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n❌ エラー: ${result.error || '面接回答の生成に失敗しました'}\n\nトラブルシューティング:\n1. .envファイルにOPENAI_API_KEYが設定されているか確認\n2. インターネット接続を確認\n3. OpenAI APIキーが有効か確認`;
        }
        
    } catch (error) {
        console.error('Error communicating with Interview Assistant:', error);
        responseArea.textContent = `${sourceLabel}:\n"${text}"\n\n❌ 通信エラー: ${error}\n\n面接アシスタントとの通信に失敗しました。`;
    }
}

// Call init when DOM is loaded
document.addEventListener('DOMContentLoaded', init);