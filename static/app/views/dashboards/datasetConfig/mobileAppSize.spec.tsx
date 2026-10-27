import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';

import {SizeUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {MobileAppSizeConfig} from './mobileAppSize';

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

    it('keys grouped series by y-axis and group value, in order', () => {
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

      expect(result.map(({seriesName}) => seriesName)).toEqual([
        'max(install_size) : platform : ios',
        'max(install_size) : platform : android',
      ]);
    });
  });
});
