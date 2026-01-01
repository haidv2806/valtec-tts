/**
 * Vietnamese Grapheme-to-Phoneme (G2P) Converter for React Native (Expo)
 * Ported from viphoneme library (https://github.com/v-nhandt21/Viphoneme)
 */

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface TranscriptionResult {
    ons: string;
    nuc: string;
    cod: string;
    ton: number;
    isOOV?: boolean;
}

export interface PhonemeData {
    phonemes: number[];
    tones: number[];
    languages: number[];
}

export interface SymbolMap {
    [key: string]: number;
}

// ============================================================
// PHONEME MAPPINGS
// ============================================================

const Cus_onsets: Record<string, string> = {
    'b': 'b', 't': 't', 'th': 'tʰ', 'đ': 'd', 'ch': 'c',
    'kh': 'x', 'g': 'ɣ', 'l': 'l', 'm': 'm', 'n': 'n',
    'ngh': 'ŋ', 'nh': 'ɲ', 'ng': 'ŋ', 'ph': 'f', 'v': 'v',
    'x': 's', 'd': 'z', 'h': 'h', 'p': 'p', 'qu': 'kw',
    'gi': 'j', 'tr': 'ʈ', 'k': 'k', 'c': 'k', 'gh': 'ɣ',
    'r': 'ʐ', 's': 'ʂ'
};

const Cus_nuclei: Record<string, string> = {
    'a': 'a', 'á': 'a', 'à': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'â': 'ɤ̆', 'ấ': 'ɤ̆', 'ầ': 'ɤ̆', 'ẩ': 'ɤ̆', 'ẫ': 'ɤ̆', 'ậ': 'ɤ̆',
    'ă': 'ă', 'ắ': 'ă', 'ằ': 'ă', 'ẳ': 'ă', 'ẵ': 'ă', 'ặ': 'ă',
    'e': 'ɛ', 'é': 'ɛ', 'è': 'ɛ', 'ẻ': 'ɛ', 'ẽ': 'ɛ', 'ẹ': 'ɛ',
    'ê': 'e', 'ế': 'e', 'ề': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'i': 'i', 'í': 'i', 'ì': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'o': 'ɔ', 'ó': 'ɔ', 'ò': 'ɔ', 'ỏ': 'ɔ', 'õ': 'ɔ', 'ọ': 'ɔ',
    'ô': 'o', 'ố': 'o', 'ồ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'ɤ', 'ớ': 'ɤ', 'ờ': 'ɤ', 'ở': 'ɤ', 'ỡ': 'ɤ', 'ợ': 'ɤ',
    'u': 'u', 'ú': 'u', 'ù': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'ɯ', 'ứ': 'ɯ', 'ừ': 'ɯ', 'ử': 'ɯ', 'ữ': 'ɯ', 'ự': 'ɯ',
    'y': 'i', 'ý': 'i', 'ỳ': 'i', 'ỷ': 'i', 'ỹ': 'i', 'ỵ': 'i',
    'ia': 'iə', 'ía': 'iə', 'ìa': 'iə', 'ỉa': 'iə', 'ĩa': 'iə', 'ịa': 'iə',
    'iê': 'iə', 'iế': 'iə', 'iề': 'iə', 'iể': 'iə', 'iễ': 'iə', 'iệ': 'iə',
    'ua': 'uə', 'uô': 'uə', 'ưa': 'ɯə', 'ươ': 'ɯə', 'yê': 'iɛ', 'uơ': 'uə'
};

const Cus_offglides: Record<string, string> = {
    'ai': 'aj', 'ay': 'ăj', 'ao': 'aw', 'au': 'ăw', 'ây': 'ɤ̆j', 'âu': 'ɤ̆w',
    'eo': 'ew', 'iu': 'iw', 'oi': 'ɔj', 'ôi': 'oj', 'ui': 'uj', 'uy': 'ʷi',
    'ơi': 'ɤj', 'ưi': 'ɯj', 'ưu': 'ɯw', 'iêu': 'iəw', 'yêu': 'iəw', 'uôi': 'uəj',
    'ươi': 'ɯəj', 'ươu': 'ɯəw'
};

const Cus_onglides: Record<string, string> = {
    'oa': 'ʷa', 'oă': 'ʷă', 'oe': 'ʷɛ', 'ua': 'ʷa', 'uă': 'ʷă', 'uâ': 'ʷɤ̆',
    'ue': 'ʷɛ', 'uê': 'ʷe', 'uơ': 'ʷɤ', 'uy': 'ʷi', 'uya': 'ʷiə', 'uyê': 'ʷiə'
};

const Cus_onoffglides: Record<string, string> = {
    'oai': 'aj', 'oay': 'ăj', 'oao': 'aw', 'oeo': 'ew', 'uai': 'aj', 'uay': 'ăj', 'uây': 'ɤ̆j'
};

const Cus_codas: Record<string, string> = {
    'p': 'p', 't': 't', 'c': 'k', 'm': 'm', 'n': 'n', 'ng': 'ŋ', 'nh': 'ɲ', 'ch': 'tʃ'
};

const Cus_tones_p: Record<string, number> = {
    'á': 5, 'à': 2, 'ả': 4, 'ã': 3, 'ạ': 6, 'ấ': 5, 'ầ': 2, 'ẩ': 4, 'ẫ': 3, 'ậ': 6,
    'ắ': 5, 'ằ': 2, 'ẳ': 4, 'ẵ': 3, 'ặ': 6, 'é': 5, 'è': 2, 'ẻ': 4, 'ẽ': 3, 'ẹ': 6,
    'ế': 5, 'ề': 2, 'ể': 4, 'ễ': 3, 'ệ': 6, 'í': 5, 'ì': 2, 'ỉ': 4, 'ĩ': 3, 'ị': 6,
    'ó': 5, 'ò': 2, 'ỏ': 4, 'õ': 3, 'ọ': 6, 'ố': 5, 'ồ': 2, 'ổ': 4, 'ỗ': 3, 'ộ': 6,
    'ớ': 5, 'ờ': 2, 'ở': 4, 'ỡ': 3, 'ợ': 6, 'ú': 5, 'ù': 2, 'ủ': 4, 'ũ': 3, 'ụ': 6,
    'ứ': 5, 'ừ': 2, 'ử': 4, 'ữ': 3, 'ự': 6, 'ý': 5, 'ỳ': 2, 'ỷ': 4, 'ỹ': 3, 'ỵ': 6
};

const Cus_gi: Record<string, string> = {
    'gi': 'zi', 'gí': 'zi', 'gì': 'zi', 'gỉ': 'zi', 'gĩ': 'zi', 'gị': 'zi'
};

const Cus_qu: Record<string, string> = {
    'quy': 'kwi', 'qúy': 'kwi', 'qùy': 'kwi', 'qủy': 'kwi', 'qũy': 'kwi', 'qụy': 'kwi'
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

export function trans(word: string): TranscriptionResult {
    const lowerWord = word.toLowerCase();
    let ons = '';
    let nuc = '';
    let cod = '';
    let ton = 1;
    let oOffset = 0;
    let cOffset = 0;
    const l = lowerWord.length;

    if (l === 0) return { ons, nuc, cod, ton };

    // Detect onset
    if (lowerWord.substring(0, 3) in Cus_onsets) {
        ons = Cus_onsets[lowerWord.substring(0, 3)];
        oOffset = 3;
    } else if (lowerWord.substring(0, 2) in Cus_onsets) {
        ons = Cus_onsets[lowerWord.substring(0, 2)];
        oOffset = 2;
    } else if (lowerWord[0] in Cus_onsets) {
        ons = Cus_onsets[lowerWord[0]];
        oOffset = 1;
    }

    // Detect coda
    if (lowerWord.substring(l - 2) in Cus_codas) {
        cod = Cus_codas[lowerWord.substring(l - 2)];
        cOffset = 2;
    } else if (lowerWord[l - 1] in Cus_codas) {
        cod = Cus_codas[lowerWord[l - 1]];
        cOffset = 1;
    }

    let nucl = lowerWord.substring(oOffset, l - cOffset);

    // Special 'gi' case
    const iVariantsExceptHoi = 'iíìĩị';
    if (lowerWord[0] === 'g' && lowerWord.length === 3 && iVariantsExceptHoi.includes(lowerWord[1]) && cod) {
        nucl = 'i';
        ons = 'z';
    }

    // Nucleus matching logic
    if (nucl in Cus_nuclei) {
        nuc = Cus_nuclei[nucl];
    } else if (nucl in Cus_onglides && ons !== 'kw') {
        nuc = Cus_onglides[nucl];
        ons = ons ? ons + 'w' : 'w';
    } else if (nucl in Cus_onglides && ons === 'kw') {
        nuc = Cus_onglides[nucl];
    } else if (nucl in Cus_onoffglides) {
        const glide = Cus_onoffglides[nucl];
        cod = glide[glide.length - 1];
        nuc = glide.substring(0, glide.length - 1);
        if (ons !== 'kw') ons = ons ? ons + 'w' : 'w';
    } else if (nucl in Cus_offglides) {
        const glide = Cus_offglides[nucl];
        cod = glide[glide.length - 1];
        nuc = glide.substring(0, glide.length - 1);
    } else if (lowerWord in Cus_gi) {
        ons = Cus_gi[lowerWord][0];
        nuc = Cus_gi[lowerWord][1];
    } else if (lowerWord in Cus_qu) {
        const qu = Cus_qu[lowerWord];
        ons = qu.substring(0, qu.length - 1);
        nuc = qu[qu.length - 1];
    } else {
        return { ons: '', nuc: lowerWord, cod: '', ton: 1, isOOV: true };
    }

    // Tone extraction
    for (let i = 0; i < l; i++) {
        if (lowerWord[i] in Cus_tones_p) {
            ton = Cus_tones_p[lowerWord[i]];
            break;
        }
    }

    // Velar Fronting & Labialized
    if (nuc === 'a' && cod === 'ɲ') nuc = 'ɛ';
    if (nuc === 'a' && cod === 'k' && cOffset === 2) nuc = 'ɛ';
    if (['u', 'o', 'ɔ'].includes(nuc)) {
        if (cod === 'ŋ') cod = 'ŋ͡m';
        if (cod === 'k') cod = 'k͡p';
    }

    return { ons, nuc, cod, ton };
}

export function wordToIPA(word: string): string {
    const { ons, nuc, cod, ton, isOOV } = trans(word);
    if (isOOV) return `[${word}]`;
    return [ons, nuc, cod].filter(Boolean).join('') + ton;
}

function isCombiningMark(char: string): boolean {
    const code = char.charCodeAt(0);
    return (code >= 0x0300 && code <= 0x036F) || (code >= 0x1AB0 && code <= 0x1AFF) ||
           (code >= 0x1DC0 && code <= 0x1DFF) || (code >= 0x20D0 && code <= 0x20FF) ||
           (code >= 0xFE20 && code <= 0xFE2F);
}

export function textToPhonemes(text: string, symbolToId: SymbolMap, viLangId: number): PhonemeData {
    const phonemes: number[] = [];
    const tones: number[] = [];
    const languages: number[] = [];

    const VIPHONEME_TONE_MAP: Record<number, number> = { 1: 0, 2: 2, 3: 3, 4: 4, 5: 1, 6: 5 };
    const words = text.split(/\s+/);

    for (const word of words) {
        if (!word) continue;

        let cleanWord = word;
        const trailingPunct: string[] = [];

        while (cleanWord && /[,.!?;:'"()\[\]{}]/.test(cleanWord[cleanWord.length - 1])) {
            trailingPunct.unshift(cleanWord[cleanWord.length - 1]);
            cleanWord = cleanWord.substring(0, cleanWord.length - 1);
        }

        if (cleanWord) {
            const { ons, nuc, cod, ton, isOOV } = trans(cleanWord);
            if (isOOV) {
                phonemes.push(symbolToId['UNK'] || 305);
                tones.push(0);
                languages.push(viLangId);
            } else {
                const ipaStr = [ons, nuc, cod].filter(Boolean).join('');
                const internalTone = VIPHONEME_TONE_MAP[ton] || 0;
                const syllablePhones: string[] = [];
                
                let i = 0;
                while (i < ipaStr.length) {
                    const char = ipaStr[i];
                    if (isCombiningMark(char)) { i++; continue; }
                    if (['ʷ', 'ʰ', 'ː'].includes(char)) {
                        if (syllablePhones.length > 0) syllablePhones[syllablePhones.length - 1] += char;
                        i++; continue;
                    }
                    if (char === '\u0361' || char === '\u035c') { i++; continue; }
                    syllablePhones.push(char);
                    i++;
                }

                for (const ph of syllablePhones) {
                    phonemes.push(symbolToId[ph] ?? (symbolToId['UNK'] || 305));
                    tones.push(internalTone);
                    languages.push(viLangId);
                }
            }
        }

        for (const p of trailingPunct) {
            phonemes.push(symbolToId[p] ?? (symbolToId['UNK'] || 305));
            tones.push(0);
            languages.push(viLangId);
        }
    }

    const boundaryId = symbolToId['_'] || 0;
    phonemes.unshift(boundaryId);
    phonemes.push(boundaryId);
    tones.unshift(0);
    tones.push(0);
    languages.unshift(viLangId);
    languages.push(viLangId);

    const VI_TONE_OFFSET = 16;
    const tonesWithOffset = tones.map(t => t + VI_TONE_OFFSET);

    return { phonemes, tones: tonesWithOffset, languages };
}

export function addBlanks(input: PhonemeData, viLangId: number): PhonemeData {
    const { phonemes, tones, languages } = input;
    const withBlanks: number[] = [];
    const tonesWithBlanks: number[] = [];
    const langsWithBlanks: number[] = [];

    for (let i = 0; i < phonemes.length; i++) {
        withBlanks.push(0, phonemes[i]);
        tonesWithBlanks.push(0, tones[i]);
        langsWithBlanks.push(viLangId, languages[i]);
    }
    withBlanks.push(0);
    tonesWithBlanks.push(0);
    langsWithBlanks.push(viLangId);

    return { phonemes: withBlanks, tones: tonesWithBlanks, languages: langsWithBlanks };
}

export const VietnameseG2P = {
    textToPhonemes,
    addBlanks,
    wordToIPA,
    trans
};