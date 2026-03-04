import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {useWidgetRawCounts} from './useWidgetRawCounts';

describe('useWidgetRawCounts', () => {
  const {organization} = initializeOrg();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function TestComponent({
    selection,
    widget,
  }: {
    selection: ReturnType<typeof PageFiltersFixture>;
    widget: ReturnType<typeof WidgetFixture>;
  }) {
    const rawCounts = useWidgetRawCounts({widget, selection});

    return <div>{rawCounts?.normal.count ?? 'missing'}</div>;
  }

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
          aggregates: ['avg(value,duration,d,-)'],
          fields: ['avg(value,duration,d,-)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const normalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value,duration,d,-)': 11}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'NORMAL',
          dataset: 'tracemetrics',
          field: ['count(value,duration,d,-)'],
          project: [2],
          environment: ['prod'],
        }),
      ],
    });
    const highAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value,duration,d,-)': 13}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'HIGHEST_ACCURACY',
          dataset: 'tracemetrics',
          field: ['count(value,duration,d,-)'],
          project: [2],
          environment: ['prod'],
        }),
      ],
    });

    render(<TestComponent widget={widget} selection={selection} />, {organization});

    await waitFor(() => expect(normalRequest).toHaveBeenCalled());
    expect(highAccuracyRequest).toHaveBeenCalled();
  });

  it('does not fetch raw counts for non-timeseries display types', () => {
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

    render(<TestComponent widget={widget} selection={selection} />, {organization});

    expect(normalRequest).not.toHaveBeenCalled();
    expect(highAccuracyRequest).not.toHaveBeenCalled();
  });
});
