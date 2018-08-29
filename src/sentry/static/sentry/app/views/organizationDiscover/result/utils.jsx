/*eslint no-use-before-define: ["error", { "functions": false }]*/

import React from 'react';
import styled from 'react-emotion';
import moment from 'moment';
import {orderBy} from 'lodash';

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
    res.key = key;

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
  console.log('output', output);

  const result = addNullValues(output, dates);

  if (result.length > 10) {
    console.log('truncated data', truncateChartData(data));
  }

  return result;
}

function addNullValues(chartData, dates) {
  let result = [];
  for (let key in chartData) {
    const addDates = dates.filter(
      date => !chartData[key].data.map(entry => entry.name).includes(date)
    );
    for (let i = 0; i < addDates.length; i++) {
      chartData[key].data.push({
        value: null,
        name: addDates[i],
      });
    }

    result.push({seriesName: key, data: chartData[key].data});
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

// Input is ordered by time, then count.
// Get the most recent and highest count keys, and filter out of data.
function truncateChartData(chartData) {
  const allData = orderBy(chartData, ['time', 'count'], ['desc', 'desc']);

  const top10Keys = new Set([...new Set(allData.map(({key}) => key))].slice(0, 10));

  return orderBy(
    allData.filter(row => {
      return top10Keys.has(row.key);
    }),
    ['time'],
    ['asc']
  );

  //   while (seriesNames.size < 10) {
  //   // debugger;
  //   for (let i = Object.keys(data).length - 1; i >= 0; i--) {
  //     const key = Object.keys(data)[i];
  //     data
  //       .sort(function(a, b) {
  //         return a.count < b.count ? 1 : b.count < a.count ? -1 : 0; //increasing count
  //       })
  //       .sort(function(a, b) {
  //         return a.time < b.time ? 1 : b.time < a.time ? -1 : 0;
  //       });
  //
  //     for (let j = 0; j < data[key].length; j++) {
  //       console.log('data[key][j]', data[key][j]);
  //       console.log('data[key][j][field]', data[key][j][field]);
  //       if (data[key][j]) {
  //         const seriesName = data[key][j][field];
  //         if (!seriesNames.has(seriesName)) {
  //           console.log('Series Names', seriesNames);
  //           seriesNames.add(seriesName);
  //         }
  //       }
  //
  //       // seriesNames.push(data[key][j].)
  //     }
  //
  //     // console.log("data[key", data[key]);
  //     // console.log("in loop", moment.utc(Object.keys(data)[i])*1000);
  //   }
  // }
  // console.log("length", Object.keys(data).length);

  //
  // let data = chartData.map(entry => moment.utc(entry.time * 1000).format('MMM Do'))
  // data = _.sortBy(chartData, function(o) {
  //   return new moment(o.time);
  // });
  // return data;
}

// Truncates labels for tooltip
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
