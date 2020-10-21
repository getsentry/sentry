import orderBy from 'lodash/orderBy';
import Papa from 'papaparse';
import * as React from 'react';
import styled from '@emotion/styled';

import {formatVersion} from 'app/utils/formatters';

import {Aggregation, Query, Result, SnubaResult} from '../types';
import {NUMBER_OF_SERIES_BY_DAY} from '../data';

const CHART_KEY = '__CHART_KEY__';

/**
 * Returns data formatted for basic line and bar charts, with each aggregation
 * representing a series.
 *
 * @param data Data returned from Snuba
 * @param query Query state corresponding to data
 * @returns {Array}
 */
export function getChartData(data: any[], query: any) {
  const {fields} = query;

  return query.aggregations.map((aggregation: Aggregation) => ({
    seriesName: aggregation[2],
    animation: false,
    data: data.map(res => ({
      value: res[aggregation[2]],
      name: fields.map((field: string) => `${field} ${res[field]}`).join(' '),
    })),
  }));
}

/**
 * Returns data formatted for widgets, with each aggregation representing a series.
 * Includes each aggregation's series relative percentage to total within that aggregation.
 *
 * @param data Data returned from Snuba
 * @param query Query state corresponding to data
 * @param options Options object
 * @param options.includePercentages Include percentages data
 * @returns {Array}
 */
type SeriesData = {
  value: string;
  name: string;
  fieldValues: string[];
  percentage?: number;
};

export function getChartDataForWidget(data: any[], query: Query, options: any = {}): any {
  const {fields} = query;

  const totalsBySeries = new Map();

  if (options.includePercentages) {
    query.aggregations.forEach((aggregation: Aggregation) => {
      totalsBySeries.set(
        aggregation[2],
        data.reduce((acc, res) => {
          acc += res[aggregation[2]];
          return acc;
        }, 0)
      );
    });
  }

  return query.aggregations.map((aggregation: Aggregation) => {
    const total = options.includePercentages && totalsBySeries.get(aggregation[2]);
    return {
      seriesName: aggregation[2],
      data: data.map(res => {
        const obj: SeriesData = {
          value: res[aggregation[2]],
          name: fields.map((field: string) => `${res[field]}`).join(', '),
          fieldValues: fields.map((field: string) => res[field]),
        };

        if (options.includePercentages && total) {
          obj.percentage = Math.round((res[aggregation[2]] / total) * 10000) / 100;
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
 * @param {Boolean} [options.allSeries] (default: false) Return all series instead of top 10
 * @param {Object} [options.fieldLabelMap] (default: false) Maps value from Snuba to a defined label
 * @returns {Array}
 */
export function getChartDataByDay(rawData: any[], query: Query, options: any = {}): any {
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
  // day data is complete in the case of limits being hit
  const dates = [...new Set(rawData.map(entry => formatDate(entry.time)))].reverse();

  // Temporarily store series as object with series names as keys
  const seriesHash: any = getEmptySeriesHash(top10Series, dates);

  // Insert data into series if it's in a top 10 series
  data.forEach((row: any) => {
    const key = row[CHART_KEY];

    const dateIdx = dates.indexOf(formatDate(row.time));

    if (top10Series.has(key)) {
      seriesHash[key][dateIdx].value = row[aggregate] === null ? 0 : row[aggregate];
    }
  });

  // Format for echarts
  return Object.entries(seriesHash).map(([seriesName, series]) => ({
    seriesName,
    data: series,
  }));
}

/**
 * Given result data and the location query, return the correct visualization
 * @param data data object for result
 * @param current visualization from querystring
 */
export function getVisualization(data: any, current = 'table'): string {
  const {baseQuery, byDayQuery} = data;

  if (!byDayQuery.data && ['line-by-day', 'bar-by-day'].includes(current)) {
    return 'table';
  }

  if (!baseQuery.query.aggregations.length && ['line', 'bar'].includes(current)) {
    return 'table';
  }

  return ['table', 'line', 'bar', 'line-by-day', 'bar-by-day'].includes(current)
    ? current
    : 'table';
}

/**
 * Returns the page ranges of paginated tables, i.e. Results 1-100
 * @param {Object} baseQuery data
 * @returns {String}
 */
export function getRowsPageRange(baseQuery: Result): string {
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
function getEmptySeriesHash(seriesSet: any, dates: number[]): any {
  const output: any = {};

  [...seriesSet].forEach(series => {
    output[series] = getEmptySeries(dates);
  });

  return output;
}

function getEmptySeries(dates: number[]) {
  return dates.map(date => ({
    value: 0,
    name: date,
  }));
}

// Get the top series ranked by latest time / largest aggregate
function getTopSeries(
  data: any,
  aggregate: string,
  limit: number = NUMBER_OF_SERIES_BY_DAY
): any {
  const allData = orderBy(data, ['time', aggregate], ['desc', 'desc']);

  const orderedData = [
    ...new Set(
      allData
        // `row` can be an empty time bucket, in which case it will have no `CHART_KEY` property
        .filter(row => typeof row[CHART_KEY] !== 'undefined')
        .map(row => row[CHART_KEY])
    ),
  ];

  return new Set(limit <= 0 ? orderedData : orderedData.slice(0, limit));
}

function getDataWithKeys(data: any[], query: Query, options = {}): any {
  const {aggregations, fields} = query;
  // We only chart the first aggregation for now
  const aggregate = aggregations[0][2];

  return data.map(row => {
    // `row` can be an empty time bucket, in which case it has no value
    // for `aggregate`
    if (!row.hasOwnProperty(aggregate)) {
      return row;
    }

    const key = fields.length
      ? fields.map(field => getLabel(row[field], options)).join(',')
      : aggregate;

    return {
      ...row,
      [CHART_KEY]: key,
    };
  });
}

function formatDate(datetime: number): number {
  return datetime * 1000;
}

// Converts a value to a string for the chart label. This could
// potentially cause incorrect grouping, e.g. if the value null and string
// 'null' are both present in the same series they will be merged into 1 value
function getLabel(value: any, options: any): string {
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

  return options.formatVersion && typeof value === 'string'
    ? formatVersion(value, true)
    : value;
}

/**
 * Takes any value and returns a display version of that value for rendering in
 * the "discover" result table. Only expected to handle the 4 types that we
 * would expect to be present in Snuba data - string, number, null and array
 *
 * @param val Value to display in table cell
 * @param idx Index if part of array
 * @returns Formatted cell contents
 */
export function getDisplayValue(val: any, idx?: number): React.ReactElement {
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
        {val.map(getDisplayValue).reduce((acc: any, curr, arrayIdx) => {
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
export function getDisplayText(val: any): string {
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

const LightGray = styled('span')`
  color: ${p => p.theme.gray400};
`;

const DarkGray = styled('span')`
  color: ${p => p.theme.gray800};
`;

/**
 * Downloads a Snuba result object as CSV format
 *
 * @param {Object} result Result received from Snuba
 * @param {Object} result.data Result data object from Snuba
 * @param {String} result.meta Result metadata from Snuba
 * @returns {Void}
 */
export function downloadAsCsv(result: SnubaResult) {
  const {meta, data} = result;
  const headings = meta.map(({name}) => name);

  const csvContent = Papa.unparse({
    fields: headings,
    data: data.map(row => headings.map(col => disableMacros(row[col]))),
  });

  // Need to also manually replace # since encodeURI skips them
  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  window.location.assign(encodedDataUrl);
}

export function disableMacros(value: string | null | boolean | number) {
  const unsafeCharacterRegex = /^[\=\+\-\@]/;

  if (typeof value === 'string' && `${value}`.match(unsafeCharacterRegex)) {
    return `'${value}`;
  }

  return value;
}
