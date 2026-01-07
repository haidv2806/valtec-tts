import TextNormalizer from "vinorm";
// Định nghĩa kiểu cho một chunk văn bản đã được xử lý
export interface TextChunk {
    text: string;
    addSilenceAfter: number; // Thời gian im lặng (giây) sau chunk này. 0 nếu không có.
}

/**
 * Hàm để chia nhỏ văn bản thành các đoạn nhỏ hơn theo các quy tắc đã định.
 * Cứ có dấu là ngắt, nhồi vào giữa 0.2s yên lặng.
 * Cứ xuống dòng là 0.5s yên lặng.
 * Cứ 10 từ mà không có dấu thì ngắt nhưng không thêm chỗ yên lặng.
 *
 * @param fullText Văn bản đầy đủ cần chia nhỏ.
 * @param maxWordsPerChunk Khi không có dấu câu, chia thành các đoạn không quá số từ này.
 * @returns Mảng các TextChunk đã được xử lý.
 */
export function splitTextIntoChunks(fullText: string, maxWordsPerChunk: number = 10, SHORT_SILENCE: number = 0.2, LONG_SILENCE: number = 0.5): TextChunk[] {
    const normalizeText = TextNormalizer.normalize(fullText, {
        lower: true,
        punc: false,
        unknown: false,
    });

    console.log(
        normalizeText
    );

    const chunks: TextChunk[] = [];
    const lines = normalizeText.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            if (i < lines.length - 1) chunks.push({ text: '', addSilenceAfter: LONG_SILENCE });
            continue;
        }

        // Tách theo dấu câu nhưng giữ lại dấu câu đó trong mảng kết quả
        // Dùng split với regex có nhóm bắt giữ (capturing group) để không mất dấu câu
        const parts = line.split(/([.?!,;])/g).filter(p => p !== undefined && p.length > 0);

        let currentWords: string[] = [];

        for (let j = 0; j < parts.length; j++) {
            const part = parts[j];

            // Nếu part là một dấu câu
            if (/^[.?!,;]$/.test(part)) {
                if (currentWords.length > 0) {
                    chunks.push({
                        text: currentWords.join(' ') + part,
                        addSilenceAfter: SHORT_SILENCE
                    });
                    currentWords = [];
                } else if (chunks.length > 0) {
                    // Trường hợp hy hữu: dấu câu đứng ngay đầu dòng hoặc sau một dấu câu khác
                    const lastChunk = chunks[chunks.length - 1];
                    lastChunk.text += part;
                    lastChunk.addSilenceAfter = SHORT_SILENCE;
                }
                continue;
            }

            // Nếu part là văn bản thường
            const wordsInPart = part.trim().split(/\s+/).filter(w => w.length > 0);

            for (const word of wordsInPart) {
                currentWords.push(word);

                // KIỂM TRA QUY TẮC 10 TỪ: Ngắt ngay khi chạm mốc
                if (currentWords.length === maxWordsPerChunk) {
                    chunks.push({
                        text: currentWords.join(' '),
                        addSilenceAfter: 0 // Không nghỉ vì không có dấu câu
                    });
                    currentWords = [];
                }
            }
        }

        // Xử lý nốt những từ còn sót lại sau khi kết thúc dòng
        if (currentWords.length > 0) {
            chunks.push({
                text: currentWords.join(' '),
                addSilenceAfter: 0
            });
        }

        // Thêm im lặng 0.5s sau mỗi dòng (trừ dòng cuối)
        if (i < lines.length - 1) {
            chunks.push({ text: '', addSilenceAfter: LONG_SILENCE });
        }
    }

    return chunks.filter(c => c.text.length > 0 || c.addSilenceAfter > 0);
}