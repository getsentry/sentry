import React from 'react';
import styled from 'react-emotion';

/**
 * Takes any value and returns a display version of that value for
 * rendering in the "discover" result table. Handles only the 3 types
 * that we would expect to be present in Snuba data - string, null and array
 */
function getDisplayValue(val, idx) {
  if (typeof val === 'string') {
    return <DarkGray key={idx}>{`"${val}"`}</DarkGray>;
  }

  if (val === null) {
    return <LightGray key={idx}>null</LightGray>;
  }

  if (Array.isArray(val)) {
    return (
      <span>
        [
        {val.map(getDisplayValue).reduce((acc, curr, arrayIdx) => {
          if (arrayIdx !== 0) {
            return [...acc, ',', curr];
          }
          return [...acc, curr];
        }, [])}
        ]
      </span>
    );
  }

  return val;
}

function getDisplayText(val) {
  if (typeof val === 'string') {
    return `"${val}"`;
  }

  if (val === null) {
    return 'null';
  }

  if (Array.isArray(val)) {
    return `[
        ${val.map(getDisplayValue).reduce((acc, curr, arrayIdx) => {
          if (arrayIdx !== 0) {
            return [...acc, ',', curr];
          }
          return [...acc, curr];
        }, [])}
        ]`;
  }

  return val;
}

const LightGray = styled.span`
  color: ${p => p.theme.gray1};
`;

const DarkGray = styled.span`
  color: ${p => p.theme.gray5};
`;

export {getDisplayValue, getDisplayText};
