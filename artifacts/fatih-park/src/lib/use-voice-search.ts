import { useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useVoiceSearch(language: 'tr' | 'en', onTranscript: (value: string) => void) {
  const ctor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => recognition.current?.abort(), []);
  const toggle = () => {
    if (!ctor) return;
    if (listening) { recognition.current?.stop(); return; }
    const speech = new ctor();
    recognition.current = speech;
    speech.lang = language === 'tr' ? 'tr-TR' : 'en-US';
    speech.interimResults = false;
    speech.continuous = false;
    speech.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onTranscript(transcript);
    };
    speech.onerror = (event) => {
      setError(language === 'tr'
        ? (event.error === 'not-allowed' ? 'Mikrofon izni verilmedi. Yazarak arayabilirsiniz.' : 'Ses algılanamadı. Tekrar deneyin veya yazın.')
        : (event.error === 'not-allowed' ? 'Microphone permission was denied. You can type instead.' : 'Could not recognize speech. Try again or type.'));
      setListening(false);
    };
    speech.onend = () => setListening(false);
    setError('');
    try { speech.start(); setListening(true); }
    catch { setError(language === 'tr' ? 'Sesli arama başlatılamadı.' : 'Voice search could not start.'); }
  };
  return { available: !!ctor, listening, error, toggle };
}
