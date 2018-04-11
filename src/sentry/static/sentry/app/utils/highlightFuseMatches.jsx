import React from 'react';

/**
 * Parses matches from fuse.js library
 *
 * Example `match` would be
 * {
 *  value: 'Authentication tokens allow you to perform actions',
 *  indices: [[4, 6], [12, 13], [15, 16]],
 * }
 *
 * So:
 *  0-3 -> not highlighted,
 *  4-6 -> highlighted,
 *  7-11 -> not highlighted,
 *  12-13 -> highlighted,
 *  ...etc
 *
 * @param {Object} match The match object from fuse
 * @param {String} match.value The entire string that has matches
 * @param {Array<Number>} match.indices Array of indices that represent matches
 * @return {Array<{highlight: Boolean, text: String}>} Returns an array of {highlight, text} objects.
 */
const getFuseMatches = ({value, indices}) => {
  if (!indices.length) return [];
  let strLength = value.length;
  let result = [];
  let prev = [0, -1];

  indices.forEach(([start, end]) => {
    // Unhighlighted string before the match
    let stringBeforeMatch = value.substring(prev[1] + 1, start);

    // Only add to result if non-empty string
    if (!!stringBeforeMatch) {
      result.push({
        highlight: false,
        text: stringBeforeMatch,
      });
    }

    // This is the matched string, which should be highlighted
    let matchedString = value.substring(start, end + 1);
    result.push({
      highlight: true,
      text: matchedString,
    });

    prev = [start, end];
  });

  // The rest of the string starting from the last match index
  let restOfString = value.substring(prev[1] + 1, strLength);
  // Only add to result if non-empty string
  if (!!restOfString) {
    result.push({highlight: false, text: restOfString});
  }

  return result;
};

/**
 * Given a match object from fuse.js, returns an array of components with "highlighted" (bold) substrings.
 */
const highlightFuseMatches = matchObj => {
  return getFuseMatches(matchObj).map(({highlight, text}, index) => {
    if (!text) return null;
    if (highlight) {
      return <strong key={index}>{text}</strong>;
    }

    return <span key={index}>{text}</span>;
  });
};

export {getFuseMatches};
export default highlightFuseMatches;
