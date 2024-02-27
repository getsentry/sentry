import {NO_QUERY_ID} from 'sentry/utils/metrics/constants';
import {MetricDisplayType, MetricQueryType} from 'sentry/utils/metrics/types';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

import {getMetricQueries, toMetricDisplayType} from './utils';

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

describe('toMetricDisplayType', () => {
  it('should return the displayType if it is a valid MetricDisplayType', () => {
    expect(MetricDisplayType.BAR).toEqual(toMetricDisplayType(DisplayType.BAR));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.LINE));
    expect(MetricDisplayType.AREA).toEqual(toMetricDisplayType(DisplayType.AREA));
  });

  it('should return MetricDisplayType.LINE if the displayType is invalid or unsupported', () => {
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.BIG_NUMBER));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.TABLE));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(DisplayType.TOP_N));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(undefined));
    expect(MetricDisplayType.LINE).toEqual(toMetricDisplayType(''));
  });
});
