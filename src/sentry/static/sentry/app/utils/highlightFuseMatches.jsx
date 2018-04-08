import React from 'react';

const getFuseMatches = ({value, indices}) => {
  let strLength = value.length;
  let result = indices.reduce(
    ({prev, text}, [start, end]) => {
      // pop off the last stored value since we want to preserve string from prev.end to current start
      text.pop();

      // If this is the first match index, get text from beginning of string to current start
      // Otherwise, use previous `end`
      text.push({
        highlight: false,
        text: value.substring(prev === null ? 0 : prev[1] + 1, start),
      });

      text.push({highlight: true, text: value.substring(start, end + 1)});

      text.push({highlight: false, text: value.substring(end + 1, strLength)});

      return {
        prev: [start, end],
        text,
      };
    },
    {
      prev: null,
      text: [],
    }
  );
  return (result && result.text) || [];
};

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
