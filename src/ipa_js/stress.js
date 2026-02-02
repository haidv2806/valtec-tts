const fs = require('fs');
const path = require('path');
const syllables = require('./syllables');

const phonesPath = path.join(__dirname, './phones.json');
const phones = JSON.parse(fs.readFileSync(phonesPath, 'utf8'));

function stressType(stress) {
    stress = stress.toLowerCase();
    const _default = { "1": "ˈ", "2": "ˌ" };
    if (stress === "primary") {
        return { "1": "ˈ" };
    } else if (stress === "secondary") {
        return { "2": "ˌ" };
    } else if (stress === "both" || stress === "all") {
        return _default;
    } else {
        return _default;
    }
}

function findStress(word, type = "all") {
    const syllCount = syllables.cmuSyllableCount(word);

    if (!word.startsWith("__IGNORE__") && syllCount > 1) {
        let symbols = word.split(' ');
        const stressMap = stressType(type);
        let newWord = [];
        const clusters = ["sp", "st", "sk", "fr", "fl"];
        const stopSet = ["nasal", "fricative", "vowel"];

        for (let c of symbols) {
            const stressKeys = Object.keys(stressMap);
            if (stressKeys.includes(c[c.length - 1])) {
                if (newWord.length === 0) {
                    const stressDigit = c[c.length - 1];
                    newWord.push(stressMap[stressDigit] + c.replace(/\d/g, ""));
                } else {
                    const stressMark = stressMap[c[c.length - 1]];
                    let placed = false;
                    let hiatus = false;
                    newWord.reverse();
                    for (let i = 0; i < newWord.length; i++) {
                        let sym = newWord[i].replace(/[0-9ˈˌ]/g, "");
                        let prevSym = i > 0 ? newWord[i - 1].replace(/[0-9ˈˌ]/g, "") : null;
                        let prevPhone = prevSym ? phones[prevSym] : null;

                        if (stopSet.includes(phones[sym]) || (i > 0 && prevPhone === "stop") || ["er", "w", "j"].includes(sym)) {
                            if (prevSym && clusters.includes(sym + prevSym)) {
                                newWord[i] = stressMark + newWord[i];
                            } else if (prevPhone !== "vowel" && i > 0) {
                                newWord[i - 1] = stressMark + newWord[i - 1];
                            } else {
                                if (phones[sym] === "vowel") {
                                    hiatus = true;
                                    newWord.unshift(stressMark + c.replace(/[0-9ˈˌ]/g, ""));
                                } else {
                                    newWord[i] = stressMark + newWord[i];
                                }
                            }
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        if (newWord.length > 0) {
                            newWord[newWord.length - 1] = stressMark + newWord[newWord.length - 1];
                        }
                    }
                    newWord.reverse();
                    if (!hiatus) {
                        newWord.push(c.replace(/\d/g, ""));
                    }
                }
            } else {
                if (c.startsWith("__IGNORE__")) {
                    newWord.push(c);
                } else {
                    newWord.push(c.replace(/\d/g, ""));
                }
            }
        }
        return newWord.join(' ');
    } else {
        if (word.startsWith("__IGNORE__")) {
            return word;
        } else {
            return word.replace(/[0-9]/g, "");
        }
    }
}

module.exports = {
    findStress
};
