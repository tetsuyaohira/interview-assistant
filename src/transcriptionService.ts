import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
}

export class TranscriptionService extends EventEmitter {
    private openai: OpenAI | null = null;
    private tempDir: string;

    constructor() {
        super();
        this.tempDir = path.join(process.cwd(), 'temp');
        console.log('Temp directory path:', this.tempDir);
        this.ensureTempDir();
    }

    private ensureTempDir(): void {
        try {
            if (!fs.existsSync(this.tempDir)) {
                console.log('Creating temp directory:', this.tempDir);
                fs.mkdirSync(this.tempDir, { recursive: true });
                console.log('Temp directory created successfully');
            } else {
                console.log('Temp directory already exists');
            }
        } catch (error) {
            console.error('Failed to create temp directory:', error);
            throw error;
        }
    }

    initialize(apiKey: string): void {
        console.log('Initializing OpenAI client with API key...');
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        console.log('OpenAI client initialized successfully');
    }

    async transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
        if (!this.openai) {
            throw new Error('OpenAI client not initialized. Call initialize() first.');
        }

        try {
            // Save audio buffer to temporary file
            const tempFilePath = await this.saveAudioToTempFile(audioBuffer);
            console.log('Audio saved to temp file:', tempFilePath);

            // Create transcription request
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-1',
                language: 'ja', // Japanese
                response_format: 'json',
                temperature: 0.1
            });

            // Clean up temp file
            this.cleanupTempFile(tempFilePath);

            // Filter out irrelevant content
            const filteredText = this.filterIrrelevantText(transcription.text);
            
            if (!filteredText) {
                console.log('Transcription filtered out as irrelevant:', transcription.text);
                // Return empty result instead of throwing error
                const emptyResult: TranscriptionResult = {
                    text: '',
                    language: 'ja'
                };
                return emptyResult;
            }

            const result: TranscriptionResult = {
                text: filteredText,
                language: 'ja'
            };

            console.log('Transcription completed:', result.text.substring(0, 100) + '...');
            this.emit('transcriptionComplete', result);
            
            return result;

        } catch (error) {
            console.error('Transcription error:', error);
            this.emit('transcriptionError', error);
            throw error;
        }
    }

    private async saveAudioToTempFile(audioBuffer: Buffer): Promise<string> {
        const timestamp = Date.now();
        const filename = `audio_${timestamp}.wav`;
        const filePath = path.join(this.tempDir, filename);

        // Create WAV header for the raw audio data
        const wavBuffer = this.createWavFile(audioBuffer);
        
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, wavBuffer, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(filePath);
                }
            });
        });
    }

    private createWavFile(audioBuffer: Buffer): Buffer {
        const sampleRate = 16000;
        const channels = 1;
        const bitsPerSample = 16;

        const wavHeaderLength = 44;
        const dataLength = audioBuffer.length;
        const fileLength = wavHeaderLength + dataLength;

        const wavHeader = Buffer.alloc(wavHeaderLength);
        let offset = 0;

        // RIFF header
        wavHeader.write('RIFF', offset); offset += 4;
        wavHeader.writeUInt32LE(fileLength - 8, offset); offset += 4;
        wavHeader.write('WAVE', offset); offset += 4;

        // fmt chunk
        wavHeader.write('fmt ', offset); offset += 4;
        wavHeader.writeUInt32LE(16, offset); offset += 4; // PCM chunk size
        wavHeader.writeUInt16LE(1, offset); offset += 2;  // PCM format
        wavHeader.writeUInt16LE(channels, offset); offset += 2;
        wavHeader.writeUInt32LE(sampleRate, offset); offset += 4;
        wavHeader.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, offset); offset += 4;
        wavHeader.writeUInt16LE(channels * bitsPerSample / 8, offset); offset += 2;
        wavHeader.writeUInt16LE(bitsPerSample, offset); offset += 2;

        // data chunk
        wavHeader.write('data', offset); offset += 4;
        wavHeader.writeUInt32LE(dataLength, offset);

        return Buffer.concat([wavHeader, audioBuffer]);
    }

    private cleanupTempFile(filePath: string): void {
        try {
            fs.unlinkSync(filePath);
            console.log('Temp file cleaned up:', filePath);
        } catch (error) {
            console.warn('Failed to cleanup temp file:', error);
        }
    }

    private filterIrrelevantText(text: string): string | null {
        const trimmedText = text.trim();
        
        // Common YouTube/video platform phrases that Whisper hallucinates
        const irrelevantPhrases = [
            'ご視聴ありがとうございました',
            'チャンネル登録お願いします',
            'いいねボタンを押してください',
            'コメント欄で教えてください',
            '次の動画でお会いしましょう',
            'またお会いしましょう',
            '動画をご視聴いただき',
            'チャンネル登録',
            'いいねボタン',
            'コメント欄',
            'Thank you for watching',
            'Please subscribe',
            'Like and subscribe',
            'See you next time',
            'Thanks for watching'
        ];
        
        // Short meaningless sounds/words
        const meaninglessWords = [
            'うーん',
            'あー',
            'えー',
            'ええ',
            'あの',
            'えーっと',
            'まあ',
            'ん',
            'あ',
            'え',
            'う'
        ];
        
        // Check if text is too short (likely noise)
        if (trimmedText.length < 5) {
            return null;
        }
        
        // Check if text only contains meaningless words
        const words = trimmedText.split(/[\s\u3000]+/); // Split by space and full-width space
        const meaningfulWords = words.filter(word => 
            word.length > 1 && !meaninglessWords.includes(word)
        );
        
        if (meaningfulWords.length === 0) {
            return null;
        }
        
        // Check for exact matches of irrelevant phrases
        for (const phrase of irrelevantPhrases) {
            if (trimmedText.includes(phrase)) {
                console.log('Filtered out irrelevant phrase:', phrase);
                return null;
            }
        }
        
        // Check if text starts with common video ending patterns
        const videoEndingPatterns = [
            /^(また|次回|今回)の(動画|配信)/,
            /^それでは(また|次回)/,
            /^では(また|次回)/
        ];
        
        for (const pattern of videoEndingPatterns) {
            if (pattern.test(trimmedText)) {
                console.log('Filtered out video ending pattern:', trimmedText);
                return null;
            }
        }
        
        return trimmedText;
    }

    isInitialized(): boolean {
        return this.openai !== null;
    }
}