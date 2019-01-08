/*eslint no-use-before-define: ["error", { "functions": false }]*/
import React from 'react';
import styled from 'react-emotion';
import {orderBy} from 'lodash';
import Papa from 'papaparse';

import {NUMBER_OF_SERIES_BY_DAY} from '../data';

const CHART_KEY = '__CHART_KEY__';

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
 * Returns data formatted for charts, with each aggregation representing a series.
 * Includes each aggregation's series relative percentage to total within that aggregation.
 *
 * @param {Array} data Data returned from Snuba
 * @param {Object} query Query state corresponding to data
 * @returns {Array}
 */
export function getChartDataWithPercentages(data, query) {
  const {fields} = query;

  const totalsBySeries = new Map();

  query.aggregations.forEach(aggregation => {
    totalsBySeries.set(
      aggregation[2],
      data.reduce((acc, res) => {
        acc += res[aggregation[2]];
        return acc;
      }, 0)
    );
  });

  return query.aggregations.map(aggregation => {
    const total = totalsBySeries.get(aggregation[2]);
    return {
      seriesName: aggregation[2],
      data: data.map(res => {
        const obj = {
          value: res[aggregation[2]],
          name: fields.map(field => `${res[field]}`).join(' '),
        };

        if (total) {
          obj.percentage = Math.round(res[aggregation[2]] / total * 10000) / 100;
        }

        return obj;
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
 * @param {Object} [options] Options object
 * @param {Boolean} [options.assumeNullAsZero] (default: false) Assume null values as 0
 * @param {Boolean} [options.allSeries] (default: false) Return all series instead of top 10
 * @param {Object} [options.fieldLabelMap] (default: false) Maps value from Snuba to a defined label
 * @returns {Array}
 */
export function getChartDataByDay(rawData, query, options = {}) {
  // We only chart the first aggregation for now
  const aggregate = query.aggregations[0][2];

  const data = getDataWithKeys(rawData, query, options);

  // We only want to show the top 10 series
  const top10Series = getTopSeries(
    data,
    aggregate,
    options.allSeries ? -1 : options.allSeries
  );

  // Reverse to get ascending dates - we request descending to ensure latest
  // day data is compplete in the case of limits being hit
  const dates = [...new Set(rawData.map(entry => formatDate(entry.time)))].reverse();

  // Temporarily store series as object with series names as keys
  const seriesHash = getEmptySeriesHash(top10Series, dates, options);

  // Insert data into series if it's in a top 10 series
  data.forEach(row => {
    const key = row[CHART_KEY];

    const dateIdx = dates.indexOf(formatDate(row.time));

    if (top10Series.has(key)) {
      seriesHash[key][dateIdx].value =
        options.assumeNullAsZero && row[aggregate] === null ? 0 : row[aggregate];
    }
  });

  // Format for echarts
  return Object.entries(seriesHash).map(([seriesName, series]) => {
    return {
      seriesName,
      data: series,
    };
  });
}

/**
 * Returns the page ranges of paginated tables, i.e. Results 1-100
 * @param {Object} baseQuery data
 * @returns {String}
 */
export function getRowsPageRange(baseQuery) {
  const dataLength = baseQuery.data.data.length;

  if (!dataLength) {
    return '0 rows';
  } else if (baseQuery.query.aggregations.length) {
    return `${dataLength} ${dataLength === 1 ? 'row' : 'rows'}`;
  } else {
    const startRange = parseInt(baseQuery.current.split(':')[1], 10);
    return `rows ${startRange + 1} - ${startRange + dataLength}`;
  }
}

// Return placeholder empty series object with all series and dates listed and
// all values set to null
function getEmptySeriesHash(seriesSet, dates, options = {}) {
  const output = {};

  [...seriesSet].forEach(series => {
    output[series] = getEmptySeries(dates, options);
  });

  return output;
}

function getEmptySeries(dates, options) {
  return dates.map(date => {
    return {
      value: options.assumeNullAsZero ? 0 : null,
      name: date,
    };
  });
}

// Get the top series ranked by latest time / largest aggregate
function getTopSeries(data, aggregate, limit = NUMBER_OF_SERIES_BY_DAY) {
  const allData = orderBy(data, ['time', aggregate], ['desc', 'desc']);

  const orderedData = [...new Set(allData.map(row => row[CHART_KEY]))];

  return new Set(limit <= 0 ? orderedData : orderedData.slice(0, limit));
}

function getDataWithKeys(data, query, options = {}) {
  const {aggregations, fields} = query;
  // We only chart the first aggregation for now
  const aggregate = aggregations[0][2];

  return data.map(row => {
    const key = fields.length
      ? fields.map(field => getLabel(row[field], options)).join(',')
      : aggregate;

    return {
      ...row,
      [CHART_KEY]: key,
    };
  });
}

function formatDate(datetime) {
  return datetime * 1000;
}

// Converts a value to a string for the chart label. This could
// potentially cause incorrect grouping, e.g. if the value null and string
// 'null' are both present in the same series they will be merged into 1 value
function getLabel(value, options) {
  if (typeof value === 'object') {
    try {
      value = JSON.stringify(value);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  if (options.fieldLabelMap && options.fieldLabelMap.hasOwnProperty(value)) {
    return options.fieldLabelMap[value];
  }

  return value;
}

/**
 * Takes any value and returns a display version of that value for rendering in
 * the "discover" result table. Only expected to handle the 4 types that we
 * would expect to be present in Snuba data - string, number, null and array
 *
 * @param {*} val Value to display in table cell
 * @param {Number} idx Index if part of array
 * @returns {Object} Formatted cell contents
 */
export function getDisplayValue(val, idx) {
  if (typeof val === 'string') {
    return <DarkGray key={idx}>{`"${val}"`}</DarkGray>;
  }

  if (typeof val === 'number') {
    return <span>{val.toLocaleString()}</span>;
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

  return <span>{val}</span>;
}

/**
 * Takes any value and returns the text-only version of that value that will be
 * rendered in the table. Only expected to handle the 4 types that we would
 * expect to be present in Snuba data - string, number, null and array. This
 * function is required for dynamically calculating column width based on cell
 * contents.
 *
 * @param {*} val Value to display in table cell
 * @returns {String} Cell contents as string
 */
export function getDisplayText(val) {
  if (typeof val === 'string') {
    return `"${val}"`;
  }

  if (typeof val === 'number') {
    return val.toLocaleString();
  }

  if (val === null) {
    return 'null';
  }

  if (Array.isArray(val)) {
    return `[${val.map(getDisplayText)}]`;
  }

  return `${val}`;
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

  const csvContent = Papa.unparse({
    fields: headings,
    data: data.map(row => {
      return headings.map(col => disableMacros(row[col]));
    }),
  });

  const encodedDataUrl = encodeURI(`data:text/csv;charset=utf8,${csvContent}`);

  window.location.assign(encodedDataUrl);
}

function disableMacros(value) {
  const unsafeCharacterRegex = /^[\=\+\-\@]/;

  if (typeof value === 'string' && `${value}`.match(unsafeCharacterRegex)) {
    return `'${value}`;
  }

  return value;
}
