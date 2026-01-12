import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {WidgetType} from 'sentry/views/dashboards/types';

import type {AppSizeResponse} from './mobileAppSize';
import {MobileAppSizeConfig} from './mobileAppSize';

describe('MobileAppSizeConfig', () => {
  const organization = OrganizationFixture();

  describe('transformSeries', () => {
    it('transforms API response to series data', () => {
      const data: AppSizeResponse[] = [
        {
          data: [
            [1609459200, [{count: 1000000}]],
            [1609545600, [{count: 1100000}]],
            [1609632000, [{count: 1200000}]],
          ],
          start: 1609459200,
          end: 1609632000,
          meta: {fields: {}},
        },
      ];

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
      const data: AppSizeResponse[] = [
        {
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
        },
      ];

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

      // Should filter out null, undefined/empty, and 0 values
      expect(result[0]!.data).toHaveLength(2);
      expect(result[0]!.data[0]!.value).toBe(1000000);
      expect(result[0]!.data[1]!.value).toBe(1200000);
    });

    it('transforms multi-series grouped response', () => {
      // Multi-series response is keyed by group value, not wrapped in an array
      const data = [
        {
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
        },
      ] as unknown as AppSizeResponse[];

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
    it('uses install size aggregate by default', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
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
            yAxis: 'max(install_size)',
          }),
        })
      );
    });

    it('uses download size aggregate when specified', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
        queries: [
          {
            conditions: 'app_id:com.example.app',
            aggregates: ['max(download_size)'],
            fields: ['max(download_size)'],
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
          data: [[1609459200, [{count: 500000}]]],
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
            yAxis: 'max(download_size)',
          }),
        })
      );
    });

    it('rejects when widget query is not found', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
        queries: [],
      });

      await expect(
        MobileAppSizeConfig.getSeriesRequest!(api, widget, 0, organization, {
          datetime: {start: null, end: null, period: '14d', utc: false},
          environments: [],
          projects: [1],
        })
      ).rejects.toThrow('No widget query found');
    });

    it('includes topEvents and field params when columns are specified', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
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
      const data: AppSizeResponse[] = [];
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

      // Both aggregates should be registered to handle multi-query widgets
      expect(result).toEqual({
        'max(install_size)': 'size',
        'max(download_size)': 'size',
      });
    });
  });
});
