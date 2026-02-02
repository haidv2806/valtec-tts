const fs = require('fs');
const path = require('path');
const stress = require('./stress');

const CMU_DICT_PATH = path.join(__dirname, './CMU_dict.json');
let CMU_DICT = null;

function loadDict() {
    if (!CMU_DICT) {
        CMU_DICT = JSON.parse(fs.readFileSync(CMU_DICT_PATH, 'utf8'));
    }
    return CMU_DICT;
}

const symbols = {
    "a": "ə", "ey": "eɪ", "aa": "ɑ", "ae": "æ", "ah": "ə", "ao": "ɔ",
    "aw": "aʊ", "ay": "aɪ", "ch": "ʧ", "dh": "ð", "eh": "ɛ", "er": "ər",
    "hh": "h", "ih": "ɪ", "jh": "ʤ", "ng": "ŋ", "ow": "oʊ", "oy": "ɔɪ",
    "sh": "ʃ", "th": "θ", "uh": "ʊ", "uw": "u", "zh": "ʒ", "iy": "i", "y": "j"
};

function preprocess(words) {
    const punctStr = '!"#$%&\'()*+,-./:;<=>/?@[\\]^_`{|}~«» ';
    return words.split(/\s+/).map(w => {
        let start = 0;
        while (start < w.length && punctStr.includes(w[start])) start++;
        let end = w.length - 1;
        while (end >= 0 && punctStr.includes(w[end])) end--;
        return w.substring(start, end + 1).toLowerCase();
    }).join(' ');
}

function preservePunc(words) {
    const punctStr = '!"#$%&\'()*+,-./:;<=>/?@[\\]^_`{|}~«» ';
    return words.split(/\s+/).map(w => {
        const pre = w.match(/^([^A-Za-z0-9]+)/);
        const post = w.match(/([^A-Za-z0-9]+)$/);
        const clean = preprocess(w);
        return [pre ? pre[1] : "", clean, post ? post[1] : ""];
    });
}

function getCmu(tokens) {
    const dict = loadDict();
    return tokens.map(word => {
        if (dict[word]) {
            return dict[word];
        } else {
            return ["__IGNORE__" + word];
        }
    });
}

function cmuToIpa(cmuList, mark = true, stressMarking = 'all') {
    const ipaList = [];
    for (const wordList of cmuList) {
        let ipaWordList = [];
        for (let word of wordList) {
            if (stressMarking) {
                word = stress.findStress(word, stressMarking);
            } else {
                if (word.replace(/__IGNORE__/, "").replace(/\d/g, "") === "") {
                    // keep as is
                } else {
                    word = word.replace(/\d/g, "");
                }
            }

            let ipaForm = '';
            if (word.startsWith("__IGNORE__")) {
                ipaForm = word.replace("__IGNORE__", "");
                if (mark && ipaForm.replace(/\d/g, "") !== "") {
                    ipaForm += "*";
                }
            } else {
                const pieces = word.split(" ");
                for (const piece of pieces) {
                    let currentPiece = piece;
                    let prefix = "";
                    if (currentPiece[0] === "ˈ" || currentPiece[0] === "ˌ") {
                        prefix = currentPiece[0];
                        currentPiece = currentPiece.substring(1);
                    }
                    if (symbols[currentPiece]) {
                        ipaForm += prefix + symbols[currentPiece];
                    } else {
                        ipaForm += currentPiece;
                    }
                }
            }

            // Swaps
            const swapList = [["ˈər", "əˈr"], ["ˈie", "iˈe"]];
            for (const sym of swapList) {
                if (!ipaForm.startsWith(sym[0])) {
                    ipaForm = ipaForm.split(sym[0]).join(sym[1]);
                }
            }
            ipaWordList.push(ipaForm);
        }
        // unique and sorted
        ipaList.push([...new Set(ipaWordList)].sort());
    }
    return ipaList;
}

function getTop(ipaList) {
    return ipaList.map(wordList => wordList[wordList.length - 1]).join(' ');
}

function convert(text, retrieveAll = false, keepPunct = true, stressMarks = 'all') {
    const wordsWithPunc = preservePunc(text);
    const tokens = wordsWithPunc.map(w => w[1]);
    const cmu = getCmu(tokens);
    const ipa = cmuToIpa(cmu, true, stressMarks);

    if (keepPunct) {
        for (let i = 0; i < ipa.length; i++) {
            for (let j = 0; j < ipa[i].length; j++) {
                ipa[i][j] = wordsWithPunc[i][0] + ipa[i][j] + wordsWithPunc[i][2];
            }
        }
    }

    if (retrieveAll) {
        // Simple implementation of get_all for JS
        // (Just returning the first list for now, or you can implement the product)
        return ipa;
    }
    return getTop(ipa);
}

module.exports = {
    convert,
    preprocess,
    preservePunc
};
