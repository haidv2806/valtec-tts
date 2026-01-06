// Placeholder imports
// Bạn có thể cần cài đặt một thư viện tạo số ngẫu nhiên có seed nếu bạn cần hành vi Box-Muller chính xác như trong Java.
// Ví dụ: import seedrandom from 'seedrandom';
// Hoặc chỉ sử dụng Math.random() cho các trường hợp không cần seed.

/**
 * Vietnamese Grapheme-to-Phoneme converter for React Native.
 * Matches Python viphoneme output exactly using simplified character-by-character conversion.
 */
export class VietnameseG2P {

    static TAG = "VietnameseG2P";

    private symbolToId: Map<string, number> = new Map();
    private viLangId: number = 7;

    // viphoneme tone mapping: 1=ngang, 2=huyền, 3=ngã, 4=hỏi, 5=sắc, 6=nặng
    // Internal: 0=ngang, 1=sắc, 2=huyền, 3=ngã, 4=hỏi, 5=nặng
    private viphoneToneMap: Map<number, number> = new Map([
        [1, 0], [2, 2], [3, 3], [4, 4], [5, 1], [6, 5]
    ]);
    private viToneOffset: number = 16;

    // Tone characters to tone number (viphoneme numbering 1-6)
    private toneChars: Map<string, number> = new Map([
        ['à', 2], ['ằ', 2], ['ầ', 2], ['è', 2], ['ề', 2], ['ì', 2], ['ò', 2], ['ồ', 2], ['ờ', 2], ['ù', 2], ['ừ', 2], ['ỳ', 2],
        ['á', 5], ['ắ', 5], ['ấ', 5], ['é', 5], ['ế', 5], ['í', 5], ['ó', 5], ['ố', 5], ['ớ', 5], ['ú', 5], ['ứ', 5], ['ý', 5],
        ['ả', 4], ['ẳ', 4], ['ẩ', 4], ['ẻ', 4], ['ể', 4], ['ỉ', 4], ['ỏ', 4], ['ổ', 4], ['ở', 4], ['ủ', 4], ['ử', 4], ['ỷ', 4],
        ['ã', 3], ['ẵ', 3], ['ẫ', 3], ['ẽ', 3], ['ễ', 3], ['ĩ', 3], ['õ', 3], ['ỗ', 3], ['ỡ', 3], ['ũ', 3], ['ữ', 3], ['ỹ', 3],
        ['ạ', 6], ['ặ', 6], ['ậ', 6], ['ẹ', 6], ['ệ', 6], ['ị', 6], ['ọ', 6], ['ộ', 6], ['ợ', 6], ['ụ', 6], ['ự', 6], ['ỵ', 6]
    ]);

    // Vietnamese onset mappings (preserving original consonants where possible)
    private onsetMappings: Map<string, string> = new Map([
        ["ngh", "ŋ"], ["ng", "ŋ"], ["nh", "ɲ"], ["ch", "c"], ["tr", "ʈ"], ["th", "tʰ"],
        ["ph", "f"], ["kh", "x"], ["gh", "ɣ"], ["gi", "z"], ["qu", "kw"],
        ["đ", "d"], ["c", "k"], ["d", "z"], ["g", "ɣ"],
        ["b", "b"], ["h", "h"], ["k", "k"], ["l", "l"], ["m", "m"], ["n", "n"],
        ["p", "p"], ["r", "r"], ["s", "s"], ["t", "t"], ["v", "v"], ["x", "s"]
    ]);

    // Final consonant (coda) mappings
    private codaMappings: Map<string, string> = new Map([
        ["ng", "ŋ"], ["nh", "ɲ"], ["ch", "k"],
        ["c", "k"], ["m", "m"], ["n", "n"], ["p", "p"], ["t", "t"]
    ]);

    // Vowel mappings to IPA-like phonemes matching the symbol table
    private vowelMappings: Map<string, string> = new Map([
        // With tones - extract base vowel
        ['a', "a"], ['ă', "a"], ['â', "ə"],
        ['e', "ɛ"], ['ê', "e"],
        ['i', "i"], ['y', "i"],
        ['o', "ɔ"], ['ô', "o"], ['ơ', "ɤ"],
        ['u', "u"], ['ư', "ɯ"]
    ]);

    // Diphthong endings that map to glides
    private diphthongEndings: Map<string, string[]> = new Map([
        ["ai", ["a", "j"]], ["ay", ["a", "j"]], ["ây", ["ə", "j"]],
        ["ao", ["a", "w"]], ["au", ["a", "w"]], ["âu", ["ə", "w"]],
        ["oi", ["ɔ", "j"]], ["ôi", ["o", "j"]], ["ơi", ["ɤ", "j"]],
        ["ui", ["u", "j"]], ["ưi", ["ɯ", "j"]],
        ["eo", ["ɛ", "w"]], ["êu", ["e", "w"]],
        ["iu", ["i", "w"]], ["ưu", ["ɯ", "w"]],
        ["ia", ["i", "ə"]], ["iê", ["i", "ə"]],
        ["ua", ["u", "ə"]], ["uô", ["u", "ə"]],
        ["ưa", ["ɯ", "ə"]], ["ươ", ["ɯ", "ə"]]
    ]);

    initialize(symbolToId: Map<string, number>, viLangId: number) {
        this.symbolToId = symbolToId;
        this.viLangId = viLangId;
        console.log(VietnameseG2P.TAG, `Initialized with ${symbolToId.size} symbols, viLangId=${viLangId}`);
    }

    private getTone(word: string): number {
        for (const char of word) {
            const tone = this.toneChars.get(char);
            if (tone !== undefined) {
                return tone;
            }
        }
        return 1; // ngang (level tone)
    }

    private removeAccents(char: string): string {
        switch (char) {
            case 'à': case 'á': case 'ả': case 'ã': case 'ạ': return 'a';
            case 'ằ': case 'ắ': case 'ẳ': case 'ẵ': case 'ặ': return 'ă';
            case 'ầ': case 'ấ': case 'ẩ': case 'ẫ': case 'ậ': return 'â';
            case 'è': case 'é': case 'ẻ': case 'ẽ': case 'ẹ': return 'e';
            case 'ề': case 'ế': case 'ể': case 'ễ': case 'ệ': return 'ê';
            case 'ì': case 'í': case 'ỉ': case 'ĩ': case 'ị': return 'i';
            case 'ò': case 'ó': case 'ỏ': case 'õ': case 'ọ': return 'o';
            case 'ồ': case 'ố': case 'ổ': case 'ỗ': case 'ộ': return 'ô';
            case 'ờ': case 'ớ': case 'ở': case 'ỡ': case 'ợ': return 'ơ';
            case 'ù': case 'ú': case 'ủ': case 'ũ': case 'ụ': return 'u';
            case 'ừ': case 'ứ': case 'ử': case 'ữ': case 'ự': return 'ư';
            case 'ỳ': case 'ý': case 'ỷ': case 'ỹ': case 'ỵ': return 'y';
            default: return char;
        }
    }

    private syllableToPhonemes(word: string): { phonemes: string[]; tone: number } {
        const w = word.toLowerCase();
        const tone = this.getTone(w);
        const phonemes: string[] = [];

        if (w.length === 0) return { phonemes: [], tone: 1 };

        let remaining = w;

        // 1. Find onset
        for (const len of [3, 2, 1]) {
            if (remaining.length >= len) {
                const onset = remaining.substring(0, len);
                const mappedOnset = this.onsetMappings.get(onset);
                if (mappedOnset !== undefined) {
                    phonemes.push(mappedOnset);
                    remaining = remaining.substring(len);
                    break;
                }
            }
        }

        // 2. Find coda (from the end)
        let coda = "";
        const cleanRemaining = [...remaining].map(char => this.removeAccents(char)).join("");
        for (const len of [2, 1]) {
            if (cleanRemaining.length >= len) {
                const potentialCoda = cleanRemaining.slice(-len);
                // Check if potentialCoda is not entirely vowels (to avoid matching nucleus as coda)
                const isAllVowels = [...potentialCoda].every(char => "aeiouăâêôơưy".includes(char));
                const mappedCoda = this.codaMappings.get(potentialCoda);
                if (mappedCoda !== undefined && !isAllVowels) {
                    coda = mappedCoda;
                    remaining = remaining.slice(0, -len);
                    break;
                }
            }
        }

        // 3. Process nucleus (vowels/diphthongs)
        const nucleus = [...remaining].map(char => this.removeAccents(char)).join("");

        // Check for diphthongs first
        let foundDiphthong = false;
        for (const [diph, phones] of this.diphthongEndings) {
            if (nucleus === diph || nucleus.endsWith(diph)) {
                phonemes.push(...phones);
                foundDiphthong = true;
                break;
            }
        }

        if (!foundDiphthong) {
            // Single vowels
            for (const char of nucleus) {
                const vowel = this.vowelMappings.get(char);
                if (vowel !== undefined) {
                    phonemes.push(vowel);
                } else if (char.match(/[a-z]/i)) { // Check if it's a letter
                    phonemes.push(char);
                }
            }
        }

        // 4. Add coda
        if (coda.length > 0) {
            phonemes.push(coda);
        }

        return { phonemes, tone };
    }

    textToPhonemes(text: string): { phonemes: number[]; tones: number[]; languages: number[] } {
        const phonemes: number[] = [];
        const tones: number[] = [];
        const languages: number[] = [];

        // Simple split by whitespace, consider using a more robust tokenizer for production
        const words = text.split(/\s+/);

        for (const word of words) {
            if (word.length === 0) continue;

            let cleanWord = word;
            const trailingPunct: string[] = [];
            const punctuationRegex = /[,.!?;:'"()[\]{}]/;

            // Extract trailing punctuation
            while (cleanWord.length > 0 && punctuationRegex.test(cleanWord.slice(-1))) {
                trailingPunct.unshift(cleanWord.slice(-1)); // Add to front of array
                cleanWord = cleanWord.slice(0, -1);
            }

            if (cleanWord.length > 0) {
                const { phonemes: syllablePhonemes, tone: viphoneTone } = this.syllableToPhonemes(cleanWord);
                const internalTone = this.viphoneToneMap.get(viphoneTone) ?? 0;

                console.log(VietnameseG2P.TAG, `Word: ${cleanWord} -> Phonemes: ${syllablePhonemes.join(', ')}, Tone: ${viphoneTone} -> ${internalTone}`);

                for (const ph of syllablePhonemes) {
                    const id = this.symbolToId.get(ph) ?? this.symbolToId.get("UNK") ?? 305;
                    phonemes.push(id);
                    tones.push(internalTone);
                    languages.push(this.viLangId);
                }
            }

            for (const p of trailingPunct) {
                const pId = this.symbolToId.get(p) ?? this.symbolToId.get("UNK") ?? 305;
                phonemes.push(pId);
                tones.push(0); // Punctuation often has no tone
                languages.push(this.viLangId);
            }
        }

        const boundaryId = this.symbolToId.get("_") ?? 0;
        const resultPhonemes = [boundaryId, ...phonemes, boundaryId];
        const resultTones = [0, ...tones, 0]; // Boundary tokens often have tone 0
        const resultLangs = [this.viLangId, ...languages, this.viLangId];

        const tonesWithOffset = resultTones.map(it => it + this.viToneOffset);

        console.log(VietnameseG2P.TAG, `Final phoneme IDs: ${resultPhonemes}`);
        console.log(VietnameseG2P.TAG, `Final tones with offset: ${tonesWithOffset}`);

        return { phonemes: resultPhonemes, tones: tonesWithOffset, languages: resultLangs };
    }

    addBlanks(phonemes: number[], tones: number[], languages: number[]): { phonemes: number[]; tones: number[]; languages: number[] } {
        const withBlanks: number[] = [];
        const tonesWithBlanks: number[] = [];
        const langsWithBlanks: number[] = [];

        for (let i = 0; i < phonemes.length; i++) {
            withBlanks.push(0); // Blank
            tonesWithBlanks.push(0); // Tone for blank
            langsWithBlanks.push(this.viLangId); // Language for blank
            withBlanks.push(phonemes[i]);
            tonesWithBlanks.push(tones[i]);
            langsWithBlanks.push(languages[i]);
        }

        withBlanks.push(0); // Final blank
        tonesWithBlanks.push(0);
        langsWithBlanks.push(this.viLangId);

        return { phonemes: withBlanks, tones: tonesWithBlanks, languages: langsWithBlanks };
    }
}

