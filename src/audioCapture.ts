import mic = require('mic');
import { EventEmitter } from 'events';
import { Readable } from 'stream';

export class AudioCapture extends EventEmitter {
    private micInstance: any | null = null;
    private micInputStream: Readable | null = null;
    private isRecording: boolean = false;
    private isPaused: boolean = false;
    private audioBuffer: Buffer[] = [];
    private transcriptionTimer: NodeJS.Timeout | null = null;
    private silenceTimer: NodeJS.Timeout | null = null;
    private readonly TRANSCRIPTION_INTERVAL = 5000; // 5 seconds (fallback)
    private readonly SILENCE_THRESHOLD = 2000; // 2 seconds of silence
    private readonly MIN_AUDIO_LENGTH = 1000; // 1 second minimum audio
    private lastAudioTime: number = 0;

    constructor() {
        super();
    }

    async startCapture(audioDevice: string = 'BlackHole 2ch'): Promise<void> {
        try {
            if (this.isRecording) {
                console.log('Already recording');
                return;
            }

            console.log('Starting audio capture with device:', audioDevice);
            
            const micConfig: any = {
                rate: '16000',
                channels: '1',
                debug: false,
                exitOnSilence: 6
            };
            
            // Only set device if not default
            if (audioDevice !== 'default') {
                micConfig.device = audioDevice;
            }
            
            this.micInstance = mic(micConfig);

            this.micInputStream = this.micInstance.getAudioStream();

            if (this.micInputStream) {
                this.micInputStream.on('data', (data: Buffer) => {
                    // Only process audio data if not paused
                    if (!this.isPaused) {
                        this.audioBuffer.push(data);
                        this.emit('audioData', data);
                        
                        // Update last audio time and handle silence detection
                        this.handleAudioData();
                    }
                });

                this.micInputStream.on('error', (err: Error) => {
                    console.error('Mic input stream error:', err);
                    this.emit('error', err);
                });

                this.micInputStream.on('startComplete', () => {
                    console.log('Microphone started successfully');
                    this.isRecording = true;
                    this.emit('started');
                });

                this.micInputStream.on('stopComplete', () => {
                    console.log('Microphone stopped');
                    this.isRecording = false;
                    this.emit('stopped');
                });
            }

            this.micInstance.start();
            
            // Start transcription timer
            this.startTranscriptionTimer();

        } catch (error) {
            console.error('Error starting audio capture:', error);
            this.emit('error', error);
        }
    }

    stopCapture(): void {
        if (!this.isRecording) {
            console.log('Not currently recording');
            return;
        }

        console.log('Stopping audio capture...');
        if (this.micInstance) {
            this.micInstance.stop();
        }
        
        // Stop transcription timer and silence timer
        this.stopTranscriptionTimer();
        this.stopSilenceTimer();
    }

    pauseCapture(): void {
        if (!this.isRecording || this.isPaused) {
            console.log('Cannot pause - not recording or already paused');
            return;
        }

        console.log('Pausing audio capture...');
        this.isPaused = true;
        this.stopSilenceTimer();
        this.emit('paused');
    }

    resumeCapture(): void {
        if (!this.isRecording || !this.isPaused) {
            console.log('Cannot resume - not recording or not paused');
            return;
        }

        console.log('Resuming audio capture...');
        this.isPaused = false;
        this.emit('resumed');
    }

    getAudioBuffer(): Buffer {
        return Buffer.concat(this.audioBuffer);
    }

    clearBuffer(): void {
        this.audioBuffer = [];
    }

    async startSystemAudioCapture(): Promise<void> {
        console.log('System audio capture not implemented yet - using microphone');
        return this.startCapture();
    }

    private startTranscriptionTimer(): void {
        this.transcriptionTimer = setInterval(() => {
            if (this.audioBuffer.length > 0) {
                const audioData = this.getAudioBuffer();
                if (audioData.length > 0) {
                    console.log('Emitting audio chunk for transcription:', audioData.length, 'bytes');
                    this.emit('audioChunkReady', audioData);
                    this.clearBuffer();
                }
            }
        }, this.TRANSCRIPTION_INTERVAL);
        
        console.log('Transcription timer started (interval:', this.TRANSCRIPTION_INTERVAL, 'ms)');
    }

    private stopTranscriptionTimer(): void {
        if (this.transcriptionTimer) {
            clearInterval(this.transcriptionTimer);
            this.transcriptionTimer = null;
            console.log('Transcription timer stopped');
        }
    }

    private handleAudioData(): void {
        this.lastAudioTime = Date.now();
        
        // Reset silence timer - restart countdown when audio is detected
        this.stopSilenceTimer();
        this.startSilenceTimer();
    }

    private startSilenceTimer(): void {
        this.silenceTimer = setTimeout(() => {
            // Check if we have enough audio to transcribe
            const audioStartTime = this.lastAudioTime - this.audioBuffer.length * 64; // Rough estimate
            const audioDuration = Date.now() - audioStartTime;
            
            if (this.audioBuffer.length > 0 && audioDuration >= this.MIN_AUDIO_LENGTH) {
                const audioData = this.getAudioBuffer();
                if (audioData.length > 0) {
                    console.log('Silence detected - sending audio for transcription:', audioData.length, 'bytes');
                    this.emit('audioChunkReady', audioData);
                    this.clearBuffer();
                }
            }
        }, this.SILENCE_THRESHOLD);
        
        console.log('Silence timer started');
    }

    private stopSilenceTimer(): void {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}