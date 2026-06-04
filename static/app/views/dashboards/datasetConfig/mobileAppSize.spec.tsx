import {OrganizationFixture} from 'sentry-fixture/organization';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';

import {MobileAppSizeConfig} from './mobileAppSize';

describe('MobileAppSizeConfig', () => {
  const organization = OrganizationFixture();

  describe('transformSeries', () => {
    it('transforms API response to series data', () => {
      const data = {
        data: [
          [1609459200, [{count: 1000000}]],
          [1609545600, [{count: 1100000}]],
          [1609632000, [{count: 1200000}]],
        ],
        start: 1609459200,
        end: 1609632000,
        meta: {fields: {}},
      } as unknown as EventsStats;

      const widgetQuery = {
        conditions: 'app_id:com.example.app',
        aggregates: ['max(install_size)'],
        fields: ['max(install_size)'],
        columns: [],
        fieldAliases: [],
        name: '',
        orderby: '',
      };

      const result = MobileAppSizeConfig.transformSeries!(
        data,
        widgetQuery,
        organization
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('max(install_size)');
      expect(result[0]!.data).toHaveLength(3);
      expect(result[0]!.data[0]).toEqual({
        name: 1609459200000,
        value: 1000000,
      });
    });

    it('filters out null, undefined, and zero values', () => {
      const data = {
        data: [
          [1609459200, [{count: 1000000}]],
          [1609545600, [{count: null}]],
          [1609632000, []],
          [1609718400, [{count: 0}]],
          [1609804800, [{count: 1200000}]],
        ],
        start: 1609459200,
        end: 1609804800,
        meta: {fields: {}},
      } as unknown as EventsStats;

      const widgetQuery = {
        conditions: '',
        aggregates: [],
        fields: [],
        columns: [],
        fieldAliases: [],
        name: '',
        orderby: '',
      };

      const result = MobileAppSizeConfig.transformSeries!(
        data,
        widgetQuery,
        organization
      );

      expect(result[0]!.data).toHaveLength(2);
      expect(result[0]!.data[0]!.value).toBe(1000000);
      expect(result[0]!.data[1]!.value).toBe(1200000);
    });

    it('transforms multi-series grouped response', () => {
      // Multi-series response is keyed by group value
      const data = {
        ios: {
          data: [
            [1609459200, [{count: 1000000}]],
            [1609545600, [{count: 1100000}]],
          ],
          start: 1609459200,
          end: 1609545600,
          meta: {fields: {}},
          order: 0,
        },
        android: {
          data: [
            [1609459200, [{count: 2000000}]],
            [1609545600, [{count: 2100000}]],
          ],
          start: 1609459200,
          end: 1609545600,
          meta: {fields: {}},
          order: 1,
        },
      } as unknown as MultiSeriesEventsStats;

      const widgetQuery = {
        conditions: '',
        aggregates: ['max(install_size)'],
        fields: ['max(install_size)'],
        columns: ['platform'],
        fieldAliases: [],
        name: '',
        orderby: '',
      };

      const result = MobileAppSizeConfig.transformSeries!(
        data,
        widgetQuery,
        organization
      );

      expect(result).toHaveLength(2);
      // Should be sorted by order
      expect(result[0]!.seriesName).toBe('ios');
      expect(result[1]!.seriesName).toBe('android');
      expect(result[0]!.data).toHaveLength(2);
      expect(result[0]!.data[0]!.value).toBe(1000000);
    });
  });

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
