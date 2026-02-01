import { useState, useEffect, useCallback, useRef } from "react";

interface UseWakeWordOptions {
  wakeWord: string;
  onWakeWordDetected: () => void;
  enabled?: boolean;
}

interface UseWakeWordReturn {
  isListening: boolean;
  isModelLoaded: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  transcript: string;
}

export const useWakeWord = ({
  wakeWord,
  onWakeWordDetected,
  enabled = true,
}: UseWakeWordOptions): UseWakeWordReturn => {
  const [isListening, setIsListening] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  
  const recognizerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const normalizeText = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }, []);

  const checkForWakeWord = useCallback(
    (text: string) => {
      const normalizedText = normalizeText(text);
      const normalizedWakeWord = normalizeText(wakeWord);
      
      if (normalizedText.includes(normalizedWakeWord)) {
        onWakeWordDetected();
        return true;
      }
      return false;
    },
    [wakeWord, normalizeText, onWakeWordDetected]
  );

  const initializeVosk = useCallback(async () => {
    try {
      setError(null);
      
      // Dynamic import of vosk-browser
      const { createModel } = await import("vosk-browser");
      
      // Load the small Portuguese model
      const model = await createModel("/vosk-model-small-pt-0.3.tar.gz");
      
      recognizerRef.current = new model.KaldiRecognizer(16000);
      recognizerRef.current.setWords(true);
      
      recognizerRef.current.on("result", (message: any) => {
        const result = message.result;
        if (result && result.text) {
          setTranscript(result.text);
          checkForWakeWord(result.text);
        }
      });

      recognizerRef.current.on("partialresult", (message: any) => {
        const partial = message.result;
        if (partial && partial.partial) {
          setTranscript(partial.partial);
          checkForWakeWord(partial.partial);
        }
      });

      setIsModelLoaded(true);
    } catch (err) {
      console.error("Erro ao inicializar Vosk:", err);
      setError("Falha ao carregar modelo de reconhecimento de voz");
      setIsModelLoaded(false);
    }
  }, [checkForWakeWord]);

  const startListening = useCallback(async () => {
    if (!enabled || isListening) return;

    try {
      setError(null);

      if (!isModelLoaded) {
        await initializeVosk();
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create processor for audio data
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processorRef.current.onaudioprocess = (event) => {
        if (recognizerRef.current) {
          const audioData = event.inputBuffer.getChannelData(0);
          recognizerRef.current.acceptWaveform(audioData);
        }
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setIsListening(true);
    } catch (err) {
      console.error("Erro ao iniciar escuta:", err);
      setError("Falha ao acessar microfone");
    }
  }, [enabled, isListening, isModelLoaded, initializeVosk]);

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isModelLoaded,
    error,
    startListening,
    stopListening,
    transcript,
  };
};
