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
        conditions: 'app_id=com.example.app',
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

      expect(result).toHaveLength(1);
      expect(result[0]!.seriesName).toBe('com.example.app : max(max_install_size)');
      expect(result[0]!.data).toHaveLength(3);
      expect(result[0]!.data[0]).toEqual({
        name: 1609459200000,
        value: 1000000,
      });
    });

    it('filters out null and undefined values', () => {
      const data: AppSizeResponse[] = [
        {
          data: [
            [1609459200, [{count: 1000000}]],
            [1609545600, [{count: null}]],
            [1609632000, []],
            [1609718400, [{count: 1200000}]],
          ],
          start: 1609459200,
          end: 1609718400,
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

      expect(result[0]!.data).toHaveLength(2);
      expect(result[0]!.data[0]!.value).toBe(1000000);
      expect(result[0]!.data[1]!.value).toBe(1200000);
    });

    it('includes artifact type in series name', () => {
      const data: AppSizeResponse[] = [
        {
          data: [[1609459200, [{count: 1000000}]]],
          start: 1609459200,
          end: 1609459200,
          meta: {fields: {}},
        },
      ];

      const widgetQuery = {
        conditions: 'app_id=com.example.app&artifact_type=2',
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

      expect(result[0]!.seriesName).toContain('com.example.app');
      expect(result[0]!.seriesName).toContain('apk');
      expect(result[0]!.seriesName).toContain('max(max_install_size)');
    });

    it('includes branch and build config in series name', () => {
      const data: AppSizeResponse[] = [
        {
          data: [[1609459200, [{count: 1000000}]]],
          start: 1609459200,
          end: 1609459200,
          meta: {fields: {}},
        },
      ];

      const widgetQuery = {
        conditions:
          'app_id=com.example.app&git_head_ref=main&build_configuration_name=Release',
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

      expect(result[0]!.seriesName).toContain('com.example.app');
      expect(result[0]!.seriesName).toContain('main');
      expect(result[0]!.seriesName).toContain('Release');
      expect(result[0]!.seriesName).toContain('max(max_install_size)');
    });

    it('uses correct aggregate for download size', () => {
      const data: AppSizeResponse[] = [
        {
          data: [[1609459200, [{count: 500000}]]],
          start: 1609459200,
          end: 1609459200,
          meta: {fields: {}},
        },
      ];

      const widgetQuery = {
        conditions: 'app_id=com.example.app&size_type=download',
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

      expect(result[0]!.seriesName).toBe('com.example.app : max(max_download_size)');
    });
  });

  describe('getSeriesRequest', () => {
    it('uses install size field by default', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
        queries: [
          {
            conditions: 'app_id=com.example.app',
            aggregates: [],
            fields: [],
            columns: [],
            fieldAliases: [],
            name: '',
            orderby: '',
          },
        ],
      });

      const mockRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/preprod/app-size-stats/`,
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
        `/organizations/${organization.slug}/preprod/app-size-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            field: 'max(max_install_size)',
          }),
        })
      );
    });

    it('uses download size field when size_type=download', async () => {
      const api = new MockApiClient();
      const widget = WidgetFixture({
        widgetType: WidgetType.MOBILE_APP_SIZE,
        queries: [
          {
            conditions: 'app_id=com.example.app&size_type=download',
            aggregates: [],
            fields: [],
            columns: [],
            fieldAliases: [],
            name: '',
            orderby: '',
          },
        ],
      });

      const mockRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/preprod/app-size-stats/`,
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
        `/organizations/${organization.slug}/preprod/app-size-stats/`,
        expect.objectContaining({
          query: expect.objectContaining({
            field: 'max(max_download_size)',
          }),
        })
      );
    });
  });

  describe('getSeriesResultType', () => {
    it('returns size_base10 output type for both install and download aggregates', () => {
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
        'max(max_install_size)': 'size_base10',
        'max(max_download_size)': 'size_base10',
      });
    });
  });
});
