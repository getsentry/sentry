import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {useWidgetRawCounts} from './useWidgetRawCounts';

describe('useWidgetRawCounts', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
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
