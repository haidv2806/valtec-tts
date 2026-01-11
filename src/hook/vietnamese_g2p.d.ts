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

declare const VietnameseG2P: {
  trans(word: string): TransResult;
  wordToIPA(word: string): string;
  textToPhonemes(
    text: string,
    symbolToId: Record<string, number>,
    viLangId: number
  ): PhonemeResult;
  addBlanks(
    input: PhonemeResult,
    viLangId: number
  ): PhonemeResult;
  testG2P(): void;
};

export default VietnameseG2P;