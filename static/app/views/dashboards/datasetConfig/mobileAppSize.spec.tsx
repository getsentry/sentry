import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {SizeUnit} from 'sentry/utils/discover/fields';
import type {WidgetSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';
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

const widgetQuery = {
  conditions: '',
  aggregates: ['max(install_size)'],
  fields: ['max(install_size)'],
  columns: [],
  fieldAliases: [],
  name: '',
  orderby: '',
};

describe('MobileAppSizeConfig', () => {
  const organization = OrganizationFixture();

  describe('transformSeries', () => {
    it('names a single series by its alias and skips empty buckets', () => {
      const result = MobileAppSizeConfig.transformSeries!(
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
        {...widgetQuery, name: 'Install Size'},
        organization
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('Install Size');
      expect(result[0]!.data).toEqual([
        {name: 1000, value: 1000000},
        {name: 4000, value: 1200000},
      ]);
      expect(
        (result[0] as WidgetSeries).timeSeries?.values.map(item => item.value)
      ).toEqual([1000000, 1200000]);
    });

    it('names grouped series by group value, in order', () => {
      const result = MobileAppSizeConfig.transformSeries!(
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
        {...widgetQuery, columns: ['platform']},
        organization
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
      ...widgetQuery,
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
