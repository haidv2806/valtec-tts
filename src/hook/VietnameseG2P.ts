// VietnameseG2P.ts

/**
 * Vietnamese Grapheme-to-Phoneme converter.
 * Ported 1:1 from Kotlin implementation.
 */
export class VietnameseG2P {
  private symbolToId!: Record<string, number>;
  private viLangId = 7;

  // viphoneme tone mapping: 1=ngang, 2=huyền, 3=ngã, 4=hỏi, 5=sắc, 6=nặng
  // Internal: 0=ngang, 1=sắc, 2=huyền, 3=ngã, 4=hỏi, 5=nặng
  private readonly viphoneToneMap: Record<number, number> = {
    1: 0,
    2: 2,
    3: 3,
    4: 4,
    5: 1,
    6: 5,
  };

  private readonly viToneOffset = 16;

  private readonly toneChars: Record<string, number> = {
    à: 2, ằ: 2, ầ: 2, è: 2, ề: 2, ì: 2, ò: 2, ồ: 2, ờ: 2, ù: 2, ừ: 2, ỳ: 2,
    á: 5, ắ: 5, ấ: 5, é: 5, ế: 5, í: 5, ó: 5, ố: 5, ớ: 5, ú: 5, ứ: 5, ý: 5,
    ả: 4, ẳ: 4, ẩ: 4, ẻ: 4, ể: 4, ỉ: 4, ỏ: 4, ổ: 4, ở: 4, ủ: 4, ử: 4, ỷ: 4,
    ã: 3, ẵ: 3, ẫ: 3, ẽ: 3, ễ: 3, ĩ: 3, õ: 3, ỗ: 3, ỡ: 3, ũ: 3, ữ: 3, ỹ: 3,
    ạ: 6, ặ: 6, ậ: 6, ẹ: 6, ệ: 6, ị: 6, ọ: 6, ộ: 6, ợ: 6, ụ: 6, ự: 6, ỵ: 6,
  };

  private readonly onsetMappings: Record<string, string> = {
    ngh: "ŋ", ng: "ŋ", nh: "ɲ", ch: "c", tr: "ʈ", th: "tʰ",
    ph: "f", kh: "x", gh: "ɣ", gi: "z", qu: "kw",
    đ: "d", c: "k", d: "z", g: "ɣ",
    b: "b", h: "h", k: "k", l: "l", m: "m", n: "n",
    p: "p", r: "r", s: "s", t: "t", v: "v", x: "s",
  };

  private readonly codaMappings: Record<string, string> = {
    ng: "ŋ", nh: "ɲ", ch: "k",
    c: "k", m: "m", n: "n", p: "p", t: "t",
  };

  private readonly vowelMappings: Record<string, string> = {
    a: "a", ă: "a", â: "ə",
    e: "ɛ", ê: "e",
    i: "i", y: "i",
    o: "ɔ", ô: "o", ơ: "ɤ",
    u: "u", ư: "ɯ",
  };

  private readonly diphthongEndings: Record<string, string[]> = {
    ai: ["a", "j"], ay: ["a", "j"], ây: ["ə", "j"],
    ao: ["a", "w"], au: ["a", "w"], âu: ["ə", "w"],
    oi: ["ɔ", "j"], ôi: ["o", "j"], ơi: ["ɤ", "j"],
    ui: ["u", "j"], ưi: ["ɯ", "j"],
    eo: ["ɛ", "w"], êu: ["e", "w"],
    iu: ["i", "w"], ưu: ["ɯ", "w"],
    ia: ["i", "ə"], iê: ["i", "ə"],
    ua: ["u", "ə"], uô: ["u", "ə"],
    ưa: ["ɯ", "ə"], ươ: ["ɯ", "ə"],
  };

  initialize(symbolToId: Record<string, number>, viLangId: number) {
    this.symbolToId = symbolToId;
    this.viLangId = viLangId;
  }

  private getTone(word: string): number {
    for (const ch of word) {
      if (this.toneChars[ch] !== undefined) return this.toneChars[ch];
    }
    return 1;
  }

  private removeAccents(char: string): string {
    const map: Record<string, string> = {
      à: "a", á: "a", ả: "a", ã: "a", ạ: "a",
      ằ: "ă", ắ: "ă", ẳ: "ă", ẵ: "ă", ặ: "ă",
      ầ: "â", ấ: "â", ẩ: "â", ẫ: "â", ậ: "â",
      è: "e", é: "e", ẻ: "e", ẽ: "e", ẹ: "e",
      ề: "ê", ế: "ê", ể: "ê", ễ: "ê", ệ: "ê",
      ì: "i", í: "i", ỉ: "i", ĩ: "i", ị: "i",
      ò: "o", ó: "o", ỏ: "o", õ: "o", ọ: "o",
      ồ: "ô", ố: "ô", ổ: "ô", ỗ: "ô", ộ: "ô",
      ờ: "ơ", ớ: "ơ", ở: "ơ", ỡ: "ơ", ợ: "ơ",
      ù: "u", ú: "u", ủ: "u", ũ: "u", ụ: "u",
      ừ: "ư", ứ: "ư", ử: "ư", ữ: "ư", ự: "ư",
      ỳ: "y", ý: "y", ỷ: "y", ỹ: "y", ỵ: "y",
    };
    return map[char] ?? char;
  }

  private syllableToPhonemes(word: string): [string[], number] {
    const w = word.toLowerCase();
    const tone = this.getTone(w);
    const phonemes: string[] = [];
    if (!w) return [[], 1];

    let remaining = w;

    for (const len of [3, 2, 1]) {
      const onset = remaining.slice(0, len);
      if (this.onsetMappings[onset]) {
        phonemes.push(this.onsetMappings[onset]);
        remaining = remaining.slice(len);
        break;
      }
    }

    let coda = "";
    const cleanRemaining = [...remaining].map(c => this.removeAccents(c)).join("");
    for (const len of [2, 1]) {
      const potential = cleanRemaining.slice(-len);
      if (
        this.codaMappings[potential] &&
        ![...potential].every(c => "aeiouăâêôơưy".includes(c))
      ) {
        coda = this.codaMappings[potential];
        remaining = remaining.slice(0, -len);
        break;
      }
    }

    const nucleus = [...remaining].map(c => this.removeAccents(c)).join("");
    let found = false;

    for (const diph in this.diphthongEndings) {
      if (nucleus === diph || nucleus.endsWith(diph)) {
        phonemes.push(...this.diphthongEndings[diph]);
        found = true;
        break;
      }
    }

    if (!found) {
      for (const ch of nucleus) {
        if (this.vowelMappings[ch]) phonemes.push(this.vowelMappings[ch]);
        else if (/[a-z]/i.test(ch)) phonemes.push(ch);
      }
    }

    if (coda) phonemes.push(coda);
    return [phonemes, tone];
  }

  textToPhonemes(text: string): [number[], number[], number[]] {
    const phonemes: number[] = [];
    const tones: number[] = [];
    const languages: number[] = [];

    const words = text.split(/\s+/);
    for (const word of words) {
      if (!word) continue;

      let clean = word;
      const punct: string[] = [];
      while (clean && ",.!?;:'\"()[]{}".includes(clean.at(-1)!)) {
        punct.unshift(clean.at(-1)!);
        clean = clean.slice(0, -1);
      }

      if (clean) {
        const [phones, vTone] = this.syllableToPhonemes(clean);
        const tone = this.viphoneToneMap[vTone] ?? 0;
        for (const ph of phones) {
          phonemes.push(this.symbolToId[ph] ?? this.symbolToId["UNK"] ?? 305);
          tones.push(tone);
          languages.push(this.viLangId);
        }
      }

      for (const p of punct) {
        phonemes.push(this.symbolToId[p] ?? this.symbolToId["UNK"] ?? 305);
        tones.push(0);
        languages.push(this.viLangId);
      }
    }

    const boundary = this.symbolToId["_"] ?? 0;
    const p = [boundary, ...phonemes, boundary];
    const t = [0, ...tones, 0].map(v => v + this.viToneOffset);
    const l = [this.viLangId, ...languages, this.viLangId];

    return [p, t, l];
  }

  addBlanks(
    phonemes: number[],
    tones: number[],
    languages: number[]
  ): [number[], number[], number[]] {
    const p: number[] = [];
    const t: number[] = [];
    const l: number[] = [];

    for (let i = 0; i < phonemes.length; i++) {
      p.push(0, phonemes[i]);
      t.push(0, tones[i]);
      l.push(this.viLangId, languages[i]);
    }

    p.push(0);
    t.push(0);
    l.push(this.viLangId);

    return [p, t, l];
  }
}

