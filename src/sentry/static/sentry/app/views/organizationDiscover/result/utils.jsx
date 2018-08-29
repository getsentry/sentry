/*eslint no-use-before-define: ["error", { "functions": false }]*/

import React from 'react';
import styled from 'react-emotion';
import moment from 'moment';

/**
 * Returns data formatted for basic line and bar charts, with each aggregation
 * representing a series.
 *
 * @param {Array} data Data returned from Snuba
 * @param {Object} query Query state corresponding to data
 * @returns {Array}
 */
export function getChartData(data, query) {
  const {fields} = query;

  return query.aggregations.map(aggregation => {
    return {
      seriesName: aggregation[2],
      data: data.map(res => {
        return {
          value: res[aggregation[2]],
          name: fields.map(field => `${field} ${res[field]}`).join(' '),
        };
      }),
    };
  });
}

/**
 * Returns time series data formatted for line and bar charts, with each day
 * along the x-axis
 *
 * @param {Array} data Data returned from Snuba
 * @param {Object} query Query state corresponding to data
 * @returns {Array}
 */
export function getChartDataByDay(data, query) {
  const {aggregations, fields} = query;
  // We only chart the first aggregation for now
  const aggregate = aggregations[0][2];
  const dates = [
    ...new Set(data.map(entry => moment.utc(entry.time * 1000).format('MMM Do'))),
  ];
  const output = {};
  data.forEach(res => {
    const key = fields.length
      ? fields.map(field => getLabel(res[field])).join(',')
      : aggregate;
    if (key in output) {
      output[key].data.push({
        value: res[aggregate],
        name: moment.utc(res.time * 1000).format('MMM Do'),
      });
    } else {
      output[key] = {
        data: [
          {value: res[aggregate], name: moment.utc(res.time * 1000).format('MMM Do')},
        ],
      };
    }
  });
  const result = [];
  for (let key in output) {
    const addDates = dates.filter(
      date => !output[key].data.map(entry => entry.name).includes(date)
    );
    for (let i = 0; i < addDates.length; i++) {
      output[key].data.push({
        value: null,
        name: addDates[i],
      });
    }

    result.push({seriesName: key, data: output[key].data});
  }

  return result;
}

export function formatTooltip(seriesParams) {
  const label = seriesParams.length && seriesParams[0].axisValueLabel;
  return [
    `<div>${truncateLabel(label)}</div>`,
    seriesParams
      .filter(s => s.data[1] !== null)
      .map(s => `<div>${s.marker} ${truncateLabel(s.seriesName)}:  ${s.data[1]}</div>`)
      .join(''),
  ].join('');
}

function truncateLabel(seriesName) {
  let result = seriesName;
  if (seriesName.length > 80) {
    result = seriesName.substring(0, 80) + '…';
  }
  return result;
}

// Converts a value to a string for the chart label. This could
// potentially cause incorrect grouping, e.g. if the value null and string
// 'null' are both present in the same series they will be merged into 1 value
function getLabel(value) {
  if (typeof value === 'object') {
    try {
      value = JSON.stringify(value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  return value;
}

/**
 * Takes any value and returns a display version of that value for
 * rendering in the "discover" result table. Handles only the 3 types
 * that we would expect to be present in Snuba data - string, null and array
 */
export function getDisplayValue(val, idx) {
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

export function getDisplayText(val) {
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
