// Port of the fzf v1 algorithm to typescript
// https://github.com/junegunn/fzf/blob/f81feb1e69e5cb75797d50817752ddfe4933cd68/src/algo/algo.go#L615

// The MIT License (MIT)

// Copyright (c) 2013-2020 Junegunn Choi

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

interface Result {
  readonly end: number;
  readonly matches: ReadonlyArray<[number, number]>;
  readonly score: number;
  readonly start: number;
}

// https://github.com/junegunn/fzf/blob/f81feb1e69e5cb75797d50817752ddfe4933cd68/src/algo/algo.go#L107
const scoreMatch = 16;
const scoreGapStart = -3;
const scoreGapExtention = -1;
const bonusBoundary = scoreMatch / 2;
const bonusNonWord = scoreMatch / 2;
const bonusCamel123 = bonusBoundary + scoreGapExtention;
const bonusConsecutive = -(scoreGapStart + scoreGapExtention);
const bonusFirstCharMultiplier = 2;

enum CharTypes {
  CHAR_LOWER = 0,
  CHAR_UPPER = 1,
  CHAR_NUMBER = 2,
  CHAR_NON_WORD = 3,
}

const CharCodes = {
  lowerA: 'a'.charCodeAt(0),
  lowerZ: 'z'.charCodeAt(0),
  upperA: 'A'.charCodeAt(0),
  upperZ: 'Z'.charCodeAt(0),
  zero: '0'.charCodeAt(0),
  nine: '9'.charCodeAt(0),
};

function getCharClass(c: number): CharTypes {
  if (c >= CharCodes.lowerA && c <= CharCodes.lowerZ) {
    return CharTypes.CHAR_LOWER;
  }
  if (c >= CharCodes.upperA && c <= CharCodes.upperZ) {
    return CharTypes.CHAR_UPPER;
  }
  if (c >= CharCodes.zero && c <= CharCodes.nine) {
    return CharTypes.CHAR_NUMBER;
  }
  return CharTypes.CHAR_NON_WORD;
}

// Algo functions make two assumptions
// 1. "pattern" is given in lowercase if "caseSensitive" is false
// 2. "pattern" is already normalized if "normalize" is true
// https://github.com/junegunn/fzf/blob/f81feb1e69e5cb75797d50817752ddfe4933cd68/src/algo/algo.go#L244
export function fzf(text: string, pattern: string, caseSensitive: boolean): Result {
  if (pattern.length === 0) {
    return {end: 0, score: 0, start: 0, matches: []};
  }

  let pidx = 0;
  let sidx = -1;
  let eidx = -1;

  const textLength = text.length;
  const patternLength = pattern.length;

  for (let index = 0; index < textLength; index++) {
    let char = text[index]!;
    // This is considerably faster than blindly applying strings.ToLower to the whole string
    if (!caseSensitive) {
      const cc = char.charCodeAt(0);
      if (cc >= 65 && cc <= 90) {
        char = String.fromCharCode(cc + 32);
      }
    }
    const patternchar = pattern[pidx];

    if (char === patternchar) {
      pidx++;
      if (sidx < 0) {
        sidx = index;
      }
      if (pidx === patternLength) {
        eidx = index + 1;
        break;
      }
    }
  }

  if (eidx === -1) {
    return {end: -1, score: 0, start: -1, matches: []};
  }

  pidx--;

  for (let index = eidx - 1; index >= sidx; index--) {
    let char = text[index];
    // This is considerably faster than blindly applying strings.ToLower to the whole string
    if (!caseSensitive) {
      const cc = char!.charCodeAt(0);
      if (cc >= 65 && cc <= 90) {
        char = String.fromCharCode(cc + 32);
      }
    }
    const patternchar = pattern[pidx];

    if (char === patternchar) {
      pidx--;
      if (pidx < 0) {
        sidx = index;
        break;
      }
    }
  }

  const [score, matches] = calculateScore(text, pattern, sidx, eidx, caseSensitive);

  // Fzf will return matches per each character, we will try to merge these together
  return {
    start: sidx,
    end: eidx,
    score,
    matches,
  };
}

function bonusForCharClass(prevClass: CharTypes, currentClass: CharTypes): number {
  if (prevClass === CharTypes.CHAR_NON_WORD && currentClass !== CharTypes.CHAR_NON_WORD) {
    // Word boundary
    return bonusBoundary;
  }
  if (
    (prevClass === CharTypes.CHAR_LOWER && currentClass === CharTypes.CHAR_UPPER) ||
    (prevClass !== CharTypes.CHAR_NUMBER && currentClass === CharTypes.CHAR_NUMBER)
  ) {
    // camelCase letter123
    return bonusCamel123;
  }
  if (currentClass === CharTypes.CHAR_NON_WORD) {
    return bonusNonWord;
  }
  return 0;
}

// Implement the same sorting criteria as V2
function calculateScore(
  text: string,
  pattern: string,
  sidx: number,
  eidx: number,
  caseSensitive: boolean
): [number, ReadonlyArray<[number, number]>] {
  let pidx = 0;
  let score = 0;
  let inGap: boolean = false;
  let firstBonus = 0;
  let consecutive = 0;

  let prevCharClass = CharTypes.CHAR_NON_WORD;
  const pos: number[] = new Array(pattern.length);

  if (sidx > 0) {
    prevCharClass = getCharClass(text.charCodeAt(sidx - 1));
  }

  for (let idx = sidx; idx < eidx; idx++) {
    let char = text[idx];
    if (!caseSensitive) {
      const cc = char!.charCodeAt(0);
      if (cc >= 65 && cc <= 90) {
        char = String.fromCharCode(cc + 32);
      }
    }
    const patternchar = pattern[pidx];
    const currentCharClass = getCharClass(char!.charCodeAt(0));

    if (char === patternchar) {
      pos[pidx] = idx;
      score += scoreMatch;
      let bonus = bonusForCharClass(prevCharClass, currentCharClass);

      if (consecutive === 0) {
        firstBonus = bonus;
      } else {
        // Break consecutive chunk
        if (bonus === bonusBoundary) {
          firstBonus = bonus;
        }
        bonus = Math.max(bonus, firstBonus, bonusConsecutive);
      }

      if (pidx === 0) {
        score += bonus * bonusFirstCharMultiplier;
      } else {
        score += bonus;
      }
      inGap = false;
      consecutive++;
      pidx++;
    } else {
      if (inGap) {
        score += scoreGapExtention;
      } else {
        score += scoreGapStart;
      }
      inGap = true;
      consecutive = 0;
      firstBonus = 0;
    }
    prevCharClass = currentCharClass;
  }

  if (!pos.length) {
    throw new Error('Calculate score should not be called for a result with no matches');
  }
  // pos is where the text char matched a pattern char. If we have consecutive matches,
  // we want to update/extend our current range, otherwise we want to add a new range.

  // Init range to first match, at this point we should have at least 1
  const matches = [[pos[0], pos[0]! + 1]] as Array<[number, number]>;

  // iterate over all positions and check for overlaps from current and end of last
  // range. Positions are already sorted by match index, we can just check the last range.
  for (let i = 1; i < pos.length; i++) {
    const lastrange = matches[matches.length - 1]!;
    // if last range ends where new range stars, we can extend it
    if (lastrange[1] === pos[i]) {
      lastrange[1] = pos[i]! + 1;
    } else {
      // otherwise we add a new range
      matches.push([pos[i]!, pos[i]! + 1]);
    }
  }

  return [score, matches];
}
