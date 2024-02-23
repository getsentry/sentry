import {NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {MetricQueryType} from 'sentry/utils/metrics/types';
import type {Widget} from 'sentry/views/dashboards/types';

import {getMetricQueries} from './utils';

describe('getMetricQueries function', () => {
  it('should return metricQueries with correct parameters without dashboardFilters', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: 'query_1',
        },
      ],
    } as Widget;

    const metricQueries = getMetricQueries(widget);
    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: NO_QUERY_ID,
        mri: 'd:transactions/duration@milisecond',
        name: 'query_1',
        op: 'avg',
        query: 'foo:bar',
        type: MetricQueryType.QUERY,
      },
    ]);
  });

  it('should return metricQueries with correct parameters with dashboardFilters', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:bar',
          columns: ['release'],
          name: 'query_1',
        },
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: 'foo:baz',
          columns: [],
          name: 'query_2',
        },
      ],
    } as Widget;

    const metricQueries = getMetricQueries(widget, {release: ['1.0']});

    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: NO_QUERY_ID,
        mri: 'd:transactions/duration@milisecond',
        name: 'query_1',
        op: 'avg',
        query: 'foo:bar release:1.0',
        type: MetricQueryType.QUERY,
      },
      {
        groupBy: [],
        id: NO_QUERY_ID,
        mri: 'd:transactions/duration@milisecond',
        name: 'query_2',
        op: 'avg',
        query: 'foo:baz release:1.0',
        type: MetricQueryType.QUERY,
      },
    ]);
  });

  it('should return metricQueries with correct parameters with multiple dashboardFilters', () => {
    const widget = {
      queries: [
        {
          aggregates: ['avg(d:transactions/duration@milisecond)'],
          conditions: '',
          columns: ['release'],
          name: 'query_1',
        },
      ],
    } as Widget;

    const metricQueries = getMetricQueries(widget, {release: ['1.0', '2.0']});

    expect(metricQueries).toEqual([
      {
        groupBy: ['release'],
        id: NO_QUERY_ID,
        mri: 'd:transactions/duration@milisecond',
        name: 'query_1',
        op: 'avg',
        query: 'release:[1.0,2.0]',
        type: MetricQueryType.QUERY,
      },
    ]);
  });
});
