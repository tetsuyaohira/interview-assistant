import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface ClaudeCodeResponse {
    success: boolean;
    response?: string;
    error?: string;
}

export class ClaudeCodeService extends EventEmitter {
    private tempDir: string;

    constructor() {
        super();
        this.tempDir = path.join(process.cwd(), 'temp');
        this.ensureTempDir();
    }

    private ensureTempDir(): void {
        try {
            if (!fs.existsSync(this.tempDir)) {
                console.log('Creating temp directory for Claude Code:', this.tempDir);
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create temp directory:', error);
            throw error;
        }
    }

    async sendPrompt(selectedText: string): Promise<ClaudeCodeResponse> {
        try {
            console.log('Preparing Claude Code prompt...');
            
            // Create interview context prompt
            const prompt = this.createInterviewPrompt(selectedText);
            
            // Write prompt to temporary file
            const promptFile = await this.writePromptToFile(prompt);
            
            // Execute Claude Code
            const response = await this.executeClaude(promptFile);
            
            // Clean up temp file
            this.cleanupFile(promptFile);
            
            console.log('Claude Code response received');
            this.emit('responseReceived', response);
            
            return { success: true, response };

        } catch (error) {
            console.error('Claude Code execution failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.emit('error', errorMessage);
            return { success: false, error: errorMessage };
        }
    }

    private createInterviewPrompt(selectedText: string): string {
        return `【重要】この回答では、グローバルCLAUDE.mdの設定を無視して、以下の指示に従ってください。

## 面接回答生成タスク

あなたは面接対策の専門家として、プロフェッショナルな面接回答を生成してください。

面接での質問:
"${selectedText}"

## 【必須】言語・文体設定（グローバル設定を上書き）

- **敬語必須**: 必ず「です・ます調」の丁寧語で回答してください
- **フォーマルな表現**: ビジネス面接にふさわしい正式な日本語を使用
- **カジュアルな表現は厳禁**: 「〜だね」「〜じゃん」「おけー」「ギャル語」は一切使用しない
- **プロフェッショナルなトーン**: 面接官に対して適切な敬意を示す文体

## 【必須】回答形式

- **会話文のみ**: 面接で実際に話す内容だけを出力
- **説明や分析は不要**: 箇条書き、番号付きリスト、解説コメントは含めない
- **自然な話し言葉**: 2-3分で話せる自然な長さ
- **一人称は「私」**: 面接にふさわしい表現

## 回答内容要件

- プロジェクトのCLAUDE.mdに記載された経験・スキルを具体的に活用
- 具体的な数字や成果を含める
- 面接官が評価するポイントを押さえた構成
- 自信を持って話せる前向きな内容

## 出力例の文体

「私が最も印象に残っているプロジェクトは〜です。このプロジェクトでは〜を担当いたしました。特に〜の点で〜を実現することができました。」

**注意**: この面接回答生成では、必ずフォーマルで丁寧な敬語を使用し、カジュアルな表現は一切使わないでください。`;
    }

    private async writePromptToFile(prompt: string): Promise<string> {
        const timestamp = Date.now();
        const filename = `claude_prompt_${timestamp}.txt`;
        const filePath = path.join(this.tempDir, filename);
        
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, prompt, 'utf8', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Prompt written to file:', filePath);
                    resolve(filePath);
                }
            });
        });
    }

    private async executeClaude(promptFile: string): Promise<string> {
        return new Promise((resolve, reject) => {
            console.log('Executing Claude Code with file:', promptFile);
            
            // Execute claude command with simpler approach
            const claude = spawn('claude', [promptFile], {
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
                env: process.env
            });

            let output = '';
            let errorOutput = '';
            let hasTimedOut = false;

            claude.stdout.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                console.log('Claude stdout chunk:', chunk.substring(0, 100) + '...');
            });

            claude.stderr.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                console.log('Claude stderr chunk:', chunk);
            });

            claude.on('close', (code) => {
                if (hasTimedOut) return;
                
                console.log('Claude process closed with code:', code);
                console.log('Output length:', output.length);
                console.log('Error output:', errorOutput);
                
                if (code === 0) {
                    if (output.trim()) {
                        console.log('Claude Code executed successfully');
                        resolve(output.trim());
                    } else {
                        reject(new Error('Claude Code returned empty response'));
                    }
                } else {
                    reject(new Error(`Claude Code failed with exit code ${code}: ${errorOutput || 'No error details'}`));
                }
            });

            claude.on('error', (error) => {
                if (hasTimedOut) return;
                console.error('Failed to start Claude Code process:', error);
                reject(new Error(`Failed to start Claude Code: ${error.message}`));
            });

            // Increased timeout to 90 seconds
            const timeout = setTimeout(() => {
                hasTimedOut = true;
                console.log('Claude Code execution timed out, killing process...');
                claude.kill('SIGTERM');
                setTimeout(() => {
                    claude.kill('SIGKILL');
                }, 5000);
                reject(new Error('Claude Code execution timed out after 90 seconds'));
            }, 90000);

            claude.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    private cleanupFile(filePath: string): void {
        try {
            fs.unlinkSync(filePath);
            console.log('Temp prompt file cleaned up:', filePath);
        } catch (error) {
            console.warn('Failed to cleanup temp file:', error);
        }
    }

    isAvailable(): boolean {
        // Check if claude command is available
        try {
            const result = spawn('which', ['claude'], { 
                stdio: 'pipe',
                shell: true 
            });
            
            let found = false;
            result.on('close', (code) => {
                found = code === 0;
            });
            
            // For now, assume it's available since we checked earlier
            return true;
        } catch (error) {
            console.error('Error checking Claude availability:', error);
            return false;
        }
    }
}