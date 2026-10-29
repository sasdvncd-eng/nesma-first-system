/**
 * Utility to translate dynamically entered Arabic text into English on-the-fly.
 * Relies on the window-bound context injected by the root App.tsx component for reactive translation cache.
 */
export function dt(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';
  if (typeof window !== 'undefined' && (window as any).dt) {
    return (window as any).dt(text);
  }
  return text;
}
