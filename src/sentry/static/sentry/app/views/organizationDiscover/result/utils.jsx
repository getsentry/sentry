import React from 'react';
import styled from 'react-emotion';

/**
 * Takes any value and returns a display version of that value for
 * rendering in the "discover" result table. Handles only the 3 types
 * that we would expect to be present in Snuba data - string, null and array
 */
export function getDisplayValue(val) {
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

/**
 * Downloads a Snuba result object as CSV format
 *
 * @param {Object} result Result received from Snuba
 * @param {Object} result.data Result data object from Snuba
 * @param {String} result.meta Result metadata from Snuba
 * @returns {Void}
 */
export function downloadAsCsv(result) {
  const {meta, data} = result;
  const headings = meta.map(({name}) => name);
  const rows = [
    headings,
    ...data.map(row => {
      return headings.map(col => row[col]);
    }),
  ];

  const escapeUnsafeCols = col => (`${col}`.match(/^[\=\+\-\@]/) ? `'${col}'` : col);

  const csvContent = `data:text/csv;charset=utf-8,${rows
    .map(row => row.map(escapeUnsafeCols).join(','))
    .join('\n')}`; // Do not care about windows formats right now

  window.location.assign(encodeURIComponent(csvContent));
}
