import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AudioCapture } from './audioCapture';
import { TranscriptionService } from './transcriptionService';
import { InterviewAssistantService } from './interviewAssistantService';

// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow | null;
let audioCapture: AudioCapture | null;
let transcriptionService: TranscriptionService | null;
let interviewAssistantService: InterviewAssistantService | null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize services first
  initializeAudioCapture();
  // Then create window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function initializeAudioCapture(): void {
  audioCapture = new AudioCapture();
  
  // Initialize transcription service with API key if available
  const apiKey = process.env.OPENAI_API_KEY;
  transcriptionService = new TranscriptionService();
  
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    console.log('Found OpenAI API key in .env file, initializing...');
    transcriptionService.initialize(apiKey);
    console.log('TranscriptionService initialized successfully');
  } else {
    console.log('No valid OpenAI API key found in .env file');
  }
  
  // Initialize Interview Assistant service
  interviewAssistantService = new InterviewAssistantService();
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    interviewAssistantService.initialize(apiKey);
    console.log('InterviewAssistantService initialized with OpenAI API key');
  } else {
    console.log('InterviewAssistantService initialized without API key');
  }
  
  audioCapture.on('started', () => {
    console.log('Audio capture started');
    if (mainWindow) {
      mainWindow.webContents.send('audio-capture-started');
    }
  });
  
  audioCapture.on('stopped', () => {
    console.log('Audio capture stopped');
    if (mainWindow) {
      mainWindow.webContents.send('audio-capture-stopped');
    }
  });
  
  audioCapture.on('audioData', (data: Buffer) => {
    if (mainWindow) {
      mainWindow.webContents.send('audio-data', data);
    }
  });
  
  audioCapture.on('error', (error: Error) => {
    console.error('Audio capture error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('audio-capture-error', error.message);
    }
  });

  audioCapture.on('paused', () => {
    console.log('Audio capture paused');
    if (mainWindow) {
      mainWindow.webContents.send('audio-capture-paused');
    }
  });

  audioCapture.on('resumed', () => {
    console.log('Audio capture resumed');
    if (mainWindow) {
      mainWindow.webContents.send('audio-capture-resumed');
    }
  });

  // Handle audio chunks for transcription
  audioCapture.on('audioChunkReady', async (audioData: Buffer) => {
    if (transcriptionService && transcriptionService.isInitialized()) {
      try {
        console.log('Processing audio chunk for transcription...');
        const result = await transcriptionService.transcribeAudio(audioData);
        // Only send if there's actual text
        if (result.text && mainWindow) {
          mainWindow.webContents.send('transcription-result', result.text);
        } else {
          console.log('Empty transcription result, skipping UI update');
        }
      } catch (error) {
        console.error('Transcription failed:', error);
        if (mainWindow) {
          mainWindow.webContents.send('transcription-error', error instanceof Error ? error.message : String(error));
        }
      }
    } else {
      console.log('Transcription service not initialized, skipping chunk');
    }
  });
}

ipcMain.handle('start-audio-capture', async (): Promise<{ success: boolean; error?: string }> => {
  if (!audioCapture) {
    console.error('Audio capture not initialized');
    return { success: false, error: 'Audio capture not initialized' };
  }
  try {
    await audioCapture.startCapture();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('stop-audio-capture', (): { success: boolean; error?: string } => {
  if (audioCapture) {
    audioCapture.stopCapture();
    return { success: true };
  }
  return { success: false, error: 'Audio capture not initialized' };
});

ipcMain.handle('get-audio-buffer', (): Buffer | null => {
  if (audioCapture) {
    const buffer = audioCapture.getAudioBuffer();
    audioCapture.clearBuffer();
    return buffer;
  }
  return null;
});

ipcMain.handle('is-transcription-ready', (): boolean => {
  return transcriptionService ? transcriptionService.isInitialized() : false;
});

ipcMain.handle('check-env-status', (): { hasApiKey: boolean; message: string } => {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('Checking .env API key:', apiKey ? 'Found' : 'Not found');
  
  if (apiKey && apiKey !== 'your_openai_api_key_here') {
    return { 
      hasApiKey: true, 
      message: '.envファイルにAPIキーが設定されています' 
    };
  } else {
    return { 
      hasApiKey: false, 
      message: '.envファイルにOPENAI_API_KEYを設定してください' 
    };
  }
});

ipcMain.handle('generate-interview-response', async (event, selectedText: string): Promise<{ success: boolean; response?: string; error?: string }> => {
  if (!interviewAssistantService) {
    console.error('Interview Assistant service not initialized');
    return { success: false, error: 'Interview Assistant service not initialized' };
  }

  try {
    console.log('Generating interview response:', selectedText.substring(0, 50) + '...');
    const result = await interviewAssistantService.generateInterviewResponse(selectedText);
    return result;
  } catch (error) {
    console.error('Error generating interview response:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('pause-audio-capture', (): { success: boolean; error?: string } => {
  if (audioCapture) {
    audioCapture.pauseCapture();
    return { success: true };
  }
  return { success: false, error: 'Audio capture not initialized' };
});

ipcMain.handle('resume-audio-capture', (): { success: boolean; error?: string } => {
  if (audioCapture) {
    audioCapture.resumeCapture();
    return { success: true };
  }
  return { success: false, error: 'Audio capture not initialized' };
});

ipcMain.handle('check-interview-assistant-availability', (): boolean => {
  return interviewAssistantService ? interviewAssistantService.isInitialized() : false;
});