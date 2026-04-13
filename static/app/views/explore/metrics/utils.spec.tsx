import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  getMetricsUrlFromSavedQueryUrl,
  mapMetricUnitToFieldType,
} from 'sentry/views/explore/metrics/utils';
import {Mode} from 'sentry/views/explore/queryParams/mode';

describe('mapMetricUnitToFieldType', () => {
  it.each([
    ['millisecond', {fieldType: 'duration', unit: 'millisecond'}],
    ['nanosecond', {fieldType: 'duration', unit: 'nanosecond'}],
    ['second', {fieldType: 'duration', unit: 'second'}],
    ['minute', {fieldType: 'duration', unit: 'minute'}],
    ['byte', {fieldType: 'size', unit: 'byte'}],
    ['kibibyte', {fieldType: 'size', unit: 'kibibyte'}],
    ['megabyte', {fieldType: 'size', unit: 'megabyte'}],
    ['ratio', {fieldType: 'percentage', unit: 'ratio'}],
    ['percent', {fieldType: 'percentage', unit: 'percent'}],
    [undefined, {fieldType: 'number', unit: undefined}],
    ['-', {fieldType: 'number', unit: undefined}],
    ['custom_unit', {fieldType: 'number', unit: undefined}],
  ])('maps %s to the correct field type', (unit, expected) => {
    expect(mapMetricUnitToFieldType(unit)).toEqual(expected);
  });
});

describe('getMetricsUrlFromSavedQueryUrl', () => {
  const organization = OrganizationFixture();

  function decodeMetricFromUrl(url: string) {
    const query = qs.parseUrl(url).query;
    const metricParam = Array.isArray(query.metric) ? query.metric[0] : query.metric;
    return decodeMetricsQueryParams(metricParam!);
  }

  it('decodes orderby into sortBys for new-format queries', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-value',
            aggregateOrderby: '-sum(value,test_metric,counter,-)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,-)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'value', kind: 'desc'}]);
  });

  it('decodes aggregateOrderby into aggregateSortBys', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-timestamp',
            aggregateOrderby: '-sum(value,test_metric,counter,-)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,-)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,-)', kind: 'desc'},
    ]);
  });

  it('falls back to legacy orderby when aggregateOrderby is missing (backwards compat)', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-sum(value,test_metric,counter,-)',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,-)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,-)', kind: 'desc'},
    ]);
  });

  it('does not reuse legacy aggregate timestamp orderby as sample sort', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: 'timestamp',
            aggregateField: [
              {yAxes: ['sum(value,test_metric,counter,-)']},
              {groupBy: 'timestamp'},
            ],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'timestamp', kind: 'asc'},
    ]);
  });

  it('treats empty aggregateOrderby as new-format and preserves sample sort', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '-value',
            aggregateOrderby: '',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,-)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'value', kind: 'desc'}]);
    expect(decoded?.queryParams.aggregateSortBys).toEqual([
      {field: 'sum(value,test_metric,counter,-)', kind: 'desc'},
    ]);
  });

  it('falls back to defaults when orderby is missing', () => {
    const url = getMetricsUrlFromSavedQueryUrl({
      organization,
      savedQuery: new SavedQuery({
        id: 1,
        interval: '5m',
        name: 'test query',
        projects: [],
        dataset: 'metrics',
        dateAdded: '2025-01-01T00:00:00.000000Z',
        dateUpdated: '2025-01-01T00:00:00.000000Z',
        lastVisited: '2025-01-01T00:00:00.000000Z',
        starred: false,
        position: null,
        query: [
          {
            mode: Mode.SAMPLES,
            query: '',
            fields: ['id', 'timestamp'],
            orderby: '',
            aggregateField: [{yAxes: ['sum(value,test_metric,counter,-)']}],
            metric: {name: 'test_metric', type: 'counter'},
          },
        ],
      }),
    });

    const decoded = decodeMetricFromUrl(url);
    expect(decoded?.queryParams.sortBys).toEqual([{field: 'timestamp', kind: 'desc'}]);
  });
});
