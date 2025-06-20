import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startAudioCapture: (audioDevice?: string) => ipcRenderer.invoke('start-audio-capture', audioDevice),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  getAudioBuffer: () => ipcRenderer.invoke('get-audio-buffer'),
  isTranscriptionReady: () => ipcRenderer.invoke('is-transcription-ready'),
  checkEnvStatus: () => ipcRenderer.invoke('check-env-status'),
  generateInterviewResponse: (text: string) => ipcRenderer.invoke('generate-interview-response', text),
  checkInterviewAssistantAvailability: () => ipcRenderer.invoke('check-interview-assistant-availability'),

  // Event listeners
  onAudioCaptureStarted: (callback: () => void) => ipcRenderer.on('audio-capture-started', callback),
  onAudioCaptureStopped: (callback: () => void) => ipcRenderer.on('audio-capture-stopped', callback),
  onAudioData: (callback: (event: any, data: Buffer) => void) => ipcRenderer.on('audio-data', callback),
  onAudioCaptureError: (callback: (event: any, error: string) => void) => ipcRenderer.on('audio-capture-error', callback),
  onTranscriptionResult: (callback: (event: any, text: string) => void) => ipcRenderer.on('transcription-result', callback),
  onTranscriptionError: (callback: (event: any, error: string) => void) => ipcRenderer.on('transcription-error', callback),

  // Remove listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
});

// Types for the exposed API
declare global {
  interface Window {
    electronAPI: {
      startAudioCapture: (audioDevice?: string) => Promise<{ success: boolean; error?: string }>;
      stopAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      getAudioBuffer: () => Promise<Buffer | null>;
      isTranscriptionReady: () => Promise<boolean>;
      checkEnvStatus: () => Promise<{ hasApiKey: boolean; message: string }>;
      generateInterviewResponse: (text: string) => Promise<{ success: boolean; response?: string; error?: string }>;
      checkInterviewAssistantAvailability: () => Promise<boolean>;
      onAudioCaptureStarted: (callback: () => void) => void;
      onAudioCaptureStopped: (callback: () => void) => void;
      onAudioData: (callback: (event: any, data: Buffer) => void) => void;
      onAudioCaptureError: (callback: (event: any, error: string) => void) => void;
      onTranscriptionResult: (callback: (event: any, text: string) => void) => void;
      onTranscriptionError: (callback: (event: any, error: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}