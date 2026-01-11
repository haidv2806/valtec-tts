declare module './vietnamese_g2p.js' {
  export type TransResult = {
    ons: string;
    nuc: string;
    cod: string;
    ton: number;
    isOOV?: boolean;
  };

  export type PhonemeResult = {
    phonemes: number[];
    tones: number[];
    languages: number[];
  };

  export function trans(word: string): TransResult;

  export function wordToIPA(word: string): string;

  export function textToPhonemes(
    text: string,
    symbolToId: Record<string, number>,
    viLangId: number
  ): PhonemeResult;

  export function addBlanks(
    input: PhonemeResult,
    viLangId: number
  ): PhonemeResult;

  export function testG2P(): void;
}