import React from 'react';
import styled from 'react-emotion';

/**
 * Takes any value and returns a display version of that value for
 * rendering in the "discover" result table. Handles only the 3 types
 * that we would expect to be present in Snuba data - string, null and array
 */
function getDisplayValue(val) {
  if (typeof val === 'string') {
    return <DarkGray key={val}>{`"${val}"`}</DarkGray>;
  }

  if (val === null) {
    return <LightGray>null</LightGray>;
  }

  if (Array.isArray(val)) {
    return (
      <span>
        [
        {val.map(getDisplayValue).reduce((acc, curr, idx) => {
          if (idx !== 0) {
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

const LightGray = styled.span`
  color: ${p => p.theme.gray1};
`;

const DarkGray = styled.span`
  color: ${p => p.theme.gray5};
`;

export {getDisplayValue};
