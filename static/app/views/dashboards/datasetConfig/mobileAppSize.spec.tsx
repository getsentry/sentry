import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {SizeUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {MobileAppSizeConfig} from './mobileAppSize';

describe('MobileAppSizeConfig', () => {
  describe('getSeriesResultType and getSeriesResultUnit', () => {
    const singleSeriesData = {data: []} as EventsStats;
    const multiSeriesData = {
      'com.sentry.app,ios': {data: []},
      'com.sentry.app,android': {data: []},
    } as unknown as MultiSeriesEventsStats;

    const singleSeriesQuery = {
      conditions: '',
      aggregates: ['max(install_size)'],
      fields: ['max(install_size)'],
      columns: [],
      fieldAliases: [],
      name: '',
      orderby: '',
    };

    const multiAggregateQuery = {
      ...singleSeriesQuery,
      aggregates: ['max(install_size)', 'max(download_size)'],
      fields: ['max(install_size)', 'max(download_size)'],
    };

    const multiSeriesQuery = {
      ...singleSeriesQuery,
      columns: ['app_id', 'platform'],
    };

    it('returns size type for single-series aggregate', () => {
      expect(
        MobileAppSizeConfig.getSeriesResultType!(singleSeriesData, singleSeriesQuery)
      ).toEqual({'max(install_size)': 'size'});
    });

    it('returns size type for multiple aggregates', () => {
      expect(
        MobileAppSizeConfig.getSeriesResultType!(singleSeriesData, multiAggregateQuery)
      ).toEqual({
        'max(install_size)': 'size',
        'max(download_size)': 'size',
      });
    });

    it('returns size type for multi-series grouped data', () => {
      expect(
        MobileAppSizeConfig.getSeriesResultType!(multiSeriesData, multiSeriesQuery)
      ).toEqual({
        'max(install_size)': 'size',
        'com.sentry.app,ios': 'size',
        'com.sentry.app,android': 'size',
      });
    });

    it('returns byte unit for single-series aggregate', () => {
      expect(
        MobileAppSizeConfig.getSeriesResultUnit!(singleSeriesData, singleSeriesQuery)
      ).toEqual({'max(install_size)': 'byte'});
    });

    it('returns byte unit for multi-series grouped data', () => {
      expect(
        MobileAppSizeConfig.getSeriesResultUnit!(multiSeriesData, multiSeriesQuery)
      ).toEqual({
        'max(install_size)': 'byte',
        'com.sentry.app,ios': 'byte',
        'com.sentry.app,android': 'byte',
      });
    });
  });
});

function makeTimeSeries(
  yAxis: string,
  values: Array<[number, number | null]>,
  {groupBy, order}: {groupBy?: TimeSeries['groupBy']; order?: number} = {}
): TimeSeries {
  return TimeSeriesFixture({
    yAxis,
    groupBy,
    meta: {valueType: 'size', valueUnit: SizeUnit.BYTE, interval: 86_400_000, order},
    values: values.map(([timestamp, value]) => ({timestamp, value})),
  });
}

const timeSeriesWidgetQuery = {
  conditions: '',
  aggregates: ['max(install_size)'],
  fields: ['max(install_size)'],
  columns: [],
  fieldAliases: [],
  name: '',
  orderby: '',
};

describe('MobileAppSizeConfig with events-timeseries responses', () => {
  describe('transformTimeSeries', () => {
    it('names a single series by its alias and skips empty buckets', () => {
      const result = MobileAppSizeConfig.transformTimeSeries!(
        {
          timeSeries: [
            makeTimeSeries('max(install_size)', [
              [1000, 1000000],
              [2000, null],
              [3000, 0],
              [4000, 1200000],
            ]),
          ],
        },
        WidgetFixture({queries: [{...timeSeriesWidgetQuery, name: 'Install Size'}]}),
        0
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('Install Size');
      expect(
        result[0]!.timeSeries.values.map(({timestamp, value}) => [timestamp, value])
      ).toEqual([
        [1000, 1000000],
        [4000, 1200000],
      ]);
    });

    it('names grouped series by group value, in order', () => {
      const result = MobileAppSizeConfig.transformTimeSeries!(
        {
          timeSeries: [
            makeTimeSeries('max(install_size)', [[1000, 2000000]], {
              groupBy: [{key: 'platform', value: 'android'}],
              order: 1,
            }),
            makeTimeSeries('max(install_size)', [[1000, 1000000]], {
              groupBy: [{key: 'platform', value: 'ios'}],
              order: 0,
            }),
          ],
        },
        WidgetFixture({queries: [{...timeSeriesWidgetQuery, columns: ['platform']}]}),
        0
      );

      expect(result.map(({seriesName}) => seriesName)).toEqual(['ios', 'android']);
    });
  });

  it('returns size type and byte unit for every aggregate', () => {
    const data = {
      timeSeries: [
        makeTimeSeries('max(install_size)', []),
        makeTimeSeries('max(download_size)', []),
      ],
    };
    const query = {
      ...timeSeriesWidgetQuery,
      aggregates: ['max(install_size)', 'max(download_size)'],
      fields: ['max(install_size)', 'max(download_size)'],
    };

    expect(MobileAppSizeConfig.getSeriesResultType!(data, query)).toEqual({
      'max(install_size)': 'size',
      'max(download_size)': 'size',
    });
    expect(MobileAppSizeConfig.getSeriesResultUnit!(data, query)).toEqual({
      'max(install_size)': 'byte',
      'max(download_size)': 'byte',
    });
  });
});
