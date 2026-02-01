import { useState, useEffect } from "react";
import { useWakeWord } from "@/hooks/useWakeWord";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WakeWordListenerProps {
  wakeWord: string;
  onActivated: () => void;
  className?: string;
}

export const WakeWordListener = ({
  wakeWord,
  onActivated,
  className,
}: WakeWordListenerProps) => {
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isListening,
    isModelLoaded,
    error,
    startListening,
    stopListening,
    transcript,
  } = useWakeWord({
    wakeWord,
    onWakeWordDetected: () => {
      onActivated();
    },
    enabled: true,
  });

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Button
        variant={isListening ? "default" : "outline"}
        size="lg"
        onClick={toggleListening}
        className={cn(
          "relative h-16 w-16 rounded-full transition-all",
          isListening && "animate-pulse bg-primary"
        )}
        disabled={!!error}
      >
        {!isModelLoaded && !error ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : error ? (
          <AlertCircle className="h-6 w-6 text-destructive" />
        ) : isListening ? (
          <Mic className="h-6 w-6" />
        ) : (
          <MicOff className="h-6 w-6" />
        )}
        
        {isListening && (
          <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping" />
        )}
      </Button>

      <div className="text-center">
        <p className="text-sm font-medium">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : isListening ? (
            <>Ouvindo por "<span className="text-primary">{wakeWord}</span>"...</>
          ) : (
            "Clique para ativar escuta"
          )}
        </p>
        
        {isListening && transcript && (
          <p className="mt-1 text-xs text-muted-foreground max-w-48 truncate">
            "{transcript}"
          </p>
        )}
      </div>
    </div>
  );
};
