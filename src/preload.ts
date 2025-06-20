import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startAudioCapture: () => ipcRenderer.invoke('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  pauseAudioCapture: () => ipcRenderer.invoke('pause-audio-capture'),
  resumeAudioCapture: () => ipcRenderer.invoke('resume-audio-capture'),
  getAudioBuffer: () => ipcRenderer.invoke('get-audio-buffer'),
  isTranscriptionReady: () => ipcRenderer.invoke('is-transcription-ready'),
  checkEnvStatus: () => ipcRenderer.invoke('check-env-status'),
  sendToClaudeCode: (text: string) => ipcRenderer.invoke('send-to-claude-code', text),
  checkClaudeCodeAvailability: () => ipcRenderer.invoke('check-claude-code-availability'),

  // Event listeners
  onAudioCaptureStarted: (callback: () => void) => ipcRenderer.on('audio-capture-started', callback),
  onAudioCaptureStopped: (callback: () => void) => ipcRenderer.on('audio-capture-stopped', callback),
  onAudioCapturePaused: (callback: () => void) => ipcRenderer.on('audio-capture-paused', callback),
  onAudioCaptureResumed: (callback: () => void) => ipcRenderer.on('audio-capture-resumed', callback),
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
      startAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      stopAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      pauseAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      resumeAudioCapture: () => Promise<{ success: boolean; error?: string }>;
      getAudioBuffer: () => Promise<Buffer | null>;
      isTranscriptionReady: () => Promise<boolean>;
      checkEnvStatus: () => Promise<{ hasApiKey: boolean; message: string }>;
      sendToClaudeCode: (text: string) => Promise<{ success: boolean; response?: string; error?: string }>;
      checkClaudeCodeAvailability: () => Promise<boolean>;
      onAudioCaptureStarted: (callback: () => void) => void;
      onAudioCaptureStopped: (callback: () => void) => void;
      onAudioCapturePaused: (callback: () => void) => void;
      onAudioCaptureResumed: (callback: () => void) => void;
      onAudioData: (callback: (event: any, data: Buffer) => void) => void;
      onAudioCaptureError: (callback: (event: any, error: string) => void) => void;
      onTranscriptionResult: (callback: (event: any, text: string) => void) => void;
      onTranscriptionError: (callback: (event: any, error: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}