const fs = require('fs');
const path = require('path');

const phonesPath = path.join(__dirname, './phones.json');
const PHONES = JSON.parse(fs.readFileSync(phonesPath, 'utf8'));

const hiatus = [
    ["er", "iy"], ["iy", "ow"], ["uw", "ow"], ["iy", "ah"],
    ["iy", "ey"], ["uw", "eh"], ["er", "eh"]
];

function cmuSyllableCount(word) {
    if (word.startsWith("__IGNORE__")) {
        return 0;
    }
    const symbols = word.replace(/\d/g, "").split(' ');
    let nuclei = 0;
    for (let i = 0; i < symbols.length; i++) {
        const sym = symbols[i];
        const prevSym = i > 0 ? symbols[i - 1] : null;
        const prevPhone = prevSym ? PHONES[prevSym] : null;

        if (PHONES[sym] === 'vowel') {
            if (i === 0 || (i > 0 && prevPhone !== 'vowel')) {
                nuclei += 1;
            } else if (prevSym && hiatus.some(h => h[0] === prevSym && h[1] === sym)) {
                nuclei += 1;
            }
        }
    }
    return nuclei;
}

module.exports = {
    cmuSyllableCount
};
