import React from 'react';

type Match = {
  value: string;
  indices: [number, number][];
};

type HighlightResult = {
  highlight: boolean;
  text: string;
};

type MatchResult = HighlightResult[];

/**
 * Parses matches from fuse.js library
 *
 * Example `match` would be
 *
 *   {
 *    value: 'Authentication tokens allow you to perform actions',
 *    indices: [[4, 6], [12, 13], [15, 16]],
 *   }
 *
 * So:
 *
 *   00-03 -> not highlighted,
 *   04-06 -> highlighted,
 *   07-11 -> not highlighted,
 *   12-13 -> highlighted,
 *   ...etc
 *
 * @param match The match object from fuse
 * @param match.value The entire string that has matches
 * @param match.indices Array of indices that represent matches
 */
const getFuseMatches = ({value, indices}: Match): MatchResult => {
  if (indices.length === 0) {
    return [{highlight: false, text: value}];
  }

  const strLength = value.length;
  const result: MatchResult = [];
  let prev = [0, -1];

  indices.forEach(([start, end]) => {
    // Unhighlighted string before the match
    const stringBeforeMatch = value.substring(prev[1] + 1, start);

    // Only add to result if non-empty string
    if (!!stringBeforeMatch) {
      result.push({
        highlight: false,
        text: stringBeforeMatch,
      });
    }

    // This is the matched string, which should be highlighted
    const matchedString = value.substring(start, end + 1);
    result.push({
      highlight: true,
      text: matchedString,
    });

    prev = [start, end];
  });

  // The rest of the string starting from the last match index
  const restOfString = value.substring(prev[1] + 1, strLength);
  // Only add to result if non-empty string
  if (!!restOfString) {
    result.push({highlight: false, text: restOfString});
  }

  return result;
};

/**
 * Given a match object from fuse.js, returns an array of components with
 * "highlighted" (bold) substrings.
 */
const highlightFuseMatches = (matchObj: Match, Marker: React.ElementType = 'mark') =>
  getFuseMatches(matchObj).map(({highlight, text}, index) => {
    if (!text) {
      return null;
    }
    if (highlight) {
      return <Marker key={index}>{text}</Marker>;
    }

    return <span key={index}>{text}</span>;
  });

export {getFuseMatches};
export default highlightFuseMatches;
