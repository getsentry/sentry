import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {WidgetType} from 'sentry/views/dashboards/types';

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

  describe('getSeriesRequest', () => {
    it('makes request with correct dataset and yAxis', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.PREPROD_APP_SIZE,
        queries: [
          {
            conditions: 'app_id:com.example.app',
            aggregates: ['max(install_size)'],
            fields: ['max(install_size)'],
            columns: [],
            fieldAliases: [],
            name: '',
            orderby: '',
          },
        ],
      });

      const mockRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        body: {
          data: [[1609459200, [{count: 1000000}]]],
          start: 1609459200,
          end: 1609459200,
          meta: {fields: {}},
        },
      });

      await MobileAppSizeConfig.getSeriesRequest!(api, widget, 0, organization, {
        datetime: {start: null, end: null, period: '14d', utc: false},
        environments: [],
        projects: [1],
      });

      expect(mockRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'preprodSize',
            yAxis: ['max(install_size)'],
          }),
        })
      );
    });

    it('includes topEvents and field params when columns are specified', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.PREPROD_APP_SIZE,
        limit: 5,
        queries: [
          {
            conditions: '',
            aggregates: ['max(install_size)'],
            fields: ['max(install_size)'],
            columns: ['platform'],
            fieldAliases: [],
            name: '',
            orderby: '',
          },
        ],
      });

      const mockRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        body: {},
      });

      await MobileAppSizeConfig.getSeriesRequest!(api, widget, 0, organization, {
        datetime: {start: null, end: null, period: '14d', utc: false},
        environments: [],
        projects: [1],
      });

      expect(mockRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            topEvents: 5,
            field: ['platform', 'max(install_size)'],
          }),
        })
      );
    });
  });

  describe('getSeriesResultType', () => {
    it('returns size output type for both install and download aggregates', () => {
      const data = {} as EventsStats;
      const widgetQuery = {
        conditions: '',
        aggregates: [],
        fields: [],
        columns: [],
        fieldAliases: [],
        name: '',
        orderby: '',
      };

      const result = MobileAppSizeConfig.getSeriesResultType!(data, widgetQuery);

      expect(result).toEqual({
        'max(install_size)': 'size',
        'max(download_size)': 'size',
      });
    });
  });
});
