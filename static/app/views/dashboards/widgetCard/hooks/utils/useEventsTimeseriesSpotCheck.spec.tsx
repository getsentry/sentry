import * as Sentry from '@sentry/react';
import type {UseQueryResult} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {
  convertEventStatsRequestDataToEventTimeseriesQueryParams,
  getSeriesRequestData,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType} from 'sentry/views/dashboards/types';
import {isEventsTimeSeriesResponse} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {transformTimeSeriesResponseToSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';
import {useEventsTimeseriesSpotCheck} from 'sentry/views/dashboards/widgetCard/hooks/utils/useEventsTimeseriesSpotCheck';

const TIMESTAMPS = [1_700_000_000, 1_700_000_060, 1_700_000_120];

// Same transform the dataset configs use for both endpoints
const config: Pick<DatasetConfig<any, any>, 'transformSeries'> = {
  transformSeries: (data, widgetQuery) =>
    isEventsTimeSeriesResponse(data)
      ? transformTimeSeriesResponseToSeries(data, widgetQuery)
      : transformEventsResponseToSeries(data, widgetQuery),
};

describe('useEventsTimeseriesSpotCheck', () => {
  const pageFilters = PageFiltersFixture();
  const widget = WidgetFixture({
    displayType: DisplayType.LINE,
    queries: [
      {
        name: '',
        fields: ['count()'],
        aggregates: ['count()'],
        columns: [],
        conditions: '',
        orderby: '',
      },
    ],
  });
  const statsResult = {
    data: {data: TIMESTAMPS.map((timestamp, i) => [timestamp, [{count: (i + 1) * 100}]])},
    isFetching: false,
    isPlaceholderData: false,
  } as UseQueryResult<any>;

  function renderSpotCheck(organization: Organization) {
    const requestData = getSeriesRequestData(
      widget,
      0,
      organization,
      pageFilters,
      DiscoverDatasets.OURLOGS,
      'api.dashboards.widget.line-chart'
    );

    renderHookWithProviders(() =>
      useEventsTimeseriesSpotCheck({
        config,
        enabled: true,
        organization,
        pageFilters,
        statsQueryResults: [statsResult],
        timeSeriesQueries: [
          {
            params: convertEventStatsRequestDataToEventTimeseriesQueryParams(requestData),
            widgetQuery: widget.queries[0]!,
          },
        ],
        widget,
      })
    );
  }

  function mockTimeSeriesResponse(values: number[]) {
    return MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'count()',
            groupBy: null,
            meta: {valueType: 'integer', valueUnit: null, interval: 60_000},
            values: TIMESTAMPS.map((timestamp, i) => ({
              timestamp: timestamp * 1000,
              value: values[i]!,
            })),
          },
        ],
      },
    });
  }

  const spotCheckOrganization = OrganizationFixture({
    features: ['dashboards-widgets-events-timeseries-spot-check'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    jest.spyOn(Sentry.logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warning when the responses differ', async () => {
    mockTimeSeriesResponse([100, 250, 300]);
    renderSpotCheck(spotCheckOrganization);

    await waitFor(() => expect(Sentry.logger.warn).toHaveBeenCalledTimes(1));
    expect(Sentry.logger.warn).toHaveBeenCalledWith(
      'Dashboard widget `/events-timeseries/` spot-check mismatch',
      expect.objectContaining({
        dataset: 'ourlogs',
        differences: JSON.stringify([{seriesName: 'count()', reason: 'value'}]),
      })
    );
  });

  it('does not log when the responses match', async () => {
    const request = mockTimeSeriesResponse([100, 200, 300]);
    renderSpotCheck(spotCheckOrganization);

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(Sentry.logger.warn).not.toHaveBeenCalled();
  });

  it('does not fetch events-timeseries without the spot-check flag', () => {
    const request = mockTimeSeriesResponse([100, 250, 300]);
    renderSpotCheck(OrganizationFixture());

    expect(request).not.toHaveBeenCalled();
  });
});
