import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {useWidgetRawCounts} from './useWidgetRawCounts';

describe('useWidgetRawCounts', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches raw counts using normal and high accuracy for spans requests', async () => {
    const selection = PageFiltersFixture({
      projects: [2],
      environments: ['prod'],
      datetime: {
        start: null,
        end: null,
        period: '7d',
        utc: null,
      },
    });
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      queries: [
        {
          name: '',
          aggregates: ['avg(span.duration)'],
          fields: ['avg(span.duration)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const normalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 11}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'NORMAL',
          dataset: 'spans',
          field: ['count(span.duration)'],
          project: [2],
          environment: ['prod'],
          disableAggregateExtrapolation: '1',
          query: undefined,
          statsPeriod: '7d',
          referrer: 'api.explore.spans.raw-count.normal',
        }),
      ],
    });

    const totalCountRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 13}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'HIGHEST_ACCURACY',
          dataset: 'spans',
          field: ['count(span.duration)'],
          project: [2],
          statsPeriod: '7d',
          environment: ['prod'],
          disableAggregateExtrapolation: '1',
          query: undefined,
          referrer: 'api.explore.spans.raw-count.high-accuracy',
        }),
      ],
    });

    renderHookWithProviders(useWidgetRawCounts, {
      initialProps: {selection, widget},
    });

    await waitFor(() => expect(normalRequest).toHaveBeenCalled());
    await waitFor(() => expect(totalCountRequest).toHaveBeenCalled());
  });

  it('derives the trace metrics count aggregate from the widget metric', async () => {
    const selection = PageFiltersFixture({
      projects: [2],
      environments: ['prod'],
      datetime: {
        start: '2025-01-01T00:00:00',
        end: '2025-01-02T00:00:00',
        period: null,
        utc: null,
      },
    });
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      queries: [
        {
          name: '',
          aggregates: ['avg(value,test_metric,distribution,millisecond)'],
          fields: ['avg(value,test_metric,distribution,millisecond)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const normalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 11}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'NORMAL',
          dataset: 'tracemetrics',
          field: ['count(value)'],
          query:
            '( metric.name:test_metric metric.type:distribution metric.unit:millisecond )',
          project: [2],
          environment: ['prod'],
        }),
      ],
    });

    const totalCountRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 13}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'NORMAL',
          dataset: 'tracemetrics',
          field: ['count(value)'],
          project: [2],
          environment: ['prod'],
          query:
            '( metric.name:test_metric metric.type:distribution metric.unit:millisecond )',
          extrapolationMode: 'serverOnly',
          disableAggregateExtrapolation: undefined,
        }),
      ],
    });

    renderHookWithProviders(useWidgetRawCounts, {
      initialProps: {selection, widget},
    });

    await waitFor(() => expect(normalRequest).toHaveBeenCalled());
    await waitFor(() => expect(totalCountRequest).toHaveBeenCalled());
  });

  it('does not fetch raw counts for non-timeseries display types', async () => {
    const selection = PageFiltersFixture();
    const widget = WidgetFixture({
      widgetType: WidgetType.SPANS,
      displayType: DisplayType.TABLE,
    });

    const normalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 11}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'spans'})],
    });
    const highAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 13}]},
      match: [MockApiClient.matchQuery({sampling: 'HIGHEST_ACCURACY', dataset: 'spans'})],
    });

    renderHookWithProviders(useWidgetRawCounts, {
      initialProps: {selection, widget},
    });

    await waitFor(() => expect(normalRequest).not.toHaveBeenCalled());
    await waitFor(() => expect(highAccuracyRequest).not.toHaveBeenCalled());
  });
});
