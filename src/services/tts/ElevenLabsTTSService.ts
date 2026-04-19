/**
 * ElevenLabs Text-to-Speech service with sequential queue.
 *
 * Messages are queued and played one at a time — no overlapping.
 * New messages wait for the current one to finish before playing.
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export class ElevenLabsTTSService {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly modelId: string;
  private readonly stability: number;
  private readonly similarityBoost: number;
  private currentAudio: HTMLAudioElement | null = null;
  private aborted = false;
  private queue: string[] = [];
  private processing = false;
  private onStateChange: (() => void) | null = null;

  constructor(config: ElevenLabsConfig) {
    if (!config.apiKey) {
      throw new Error("ElevenLabsTTSService requires an apiKey.");
    }
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
    this.modelId = config.modelId ?? DEFAULT_MODEL_ID;
    this.stability = config.stability ?? 0.5;
    this.similarityBoost = config.similarityBoost ?? 0.75;
  }

  /** Register a callback for when speaking state changes. */
  setOnStateChange(cb: (() => void) | null): void {
    this.onStateChange = cb;
  }

  /** Whether audio is currently playing or queued. */
  get isBusy(): boolean {
    return this.processing || this.queue.length > 0;
  }

  /** Add text to the queue. It will play after any currently playing/queued messages. */
  enqueue(text: string): void {
    if (this.aborted) return;
    this.queue.push(text);
    this.processQueue();
  }

  /** Stop current playback and clear the queue. */
  stopAll(): void {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.processing = false;
    this.onStateChange?.();
  }

  /** Abort permanently — no further messages will play. */
  abort(): void {
    this.aborted = true;
    this.stopAll();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.aborted) return;

    const text = this.queue.shift();
    if (!text) return;

    this.processing = true;
    this.onStateChange?.();

    try {
      await this.playOne(text);
    } catch (err) {
      console.warn("[TTS] Playback error:", err);
    }

    this.processing = false;
    this.currentAudio = null;
    this.onStateChange?.();

    // Process next in queue
    if (this.queue.length > 0 && !this.aborted) {
      this.processQueue();
    }
  }

  private async playOne(text: string): Promise<void> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        voice_settings: {
          stability: this.stability,
          similarity_boost: this.similarityBoost,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    if (this.aborted) return;

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    this.currentAudio = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch((err) => {
        URL.revokeObjectURL(audioUrl);
        reject(err);
      });
    });
  }
}
