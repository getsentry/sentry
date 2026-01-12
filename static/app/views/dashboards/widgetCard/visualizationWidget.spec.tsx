import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DisplayType} from 'sentry/views/dashboards/types';
import {NO_PLOTTABLE_VALUES} from 'sentry/views/dashboards/widgets/common/settings';

import {VisualizationWidget} from './visualizationWidget';

describe('VisualizationWidget', () => {
  const mockSelection = {
    projects: [1],
    environments: [],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  it('renders error message when plottables array is empty (unsupported display type)', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count()'],
          columns: [],
          aggregates: ['count()'],
          orderby: '-count()',
        },
      ],
    });

    // Mock the data loader to return valid data but with TABLE display type
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{count: 100}],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1609459200, [{count: 100}]]],
      },
    });

    render(
      <VisualizationWidget
        widget={widget}
        selection={mockSelection}
        renderErrorMessage={errorMessage => <div>{errorMessage}</div>}
      />
    );

    // The component should handle empty plottables gracefully
    // and show the error message instead of throwing
    expect(screen.getByText(NO_PLOTTABLE_VALUES)).toBeInTheDocument();
  });

  it('renders error message when all plottables are empty', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: '',
          conditions: '',
          fields: ['count()'],
          columns: [],
          aggregates: ['count()'],
          orderby: '-count()',
        },
      ],
    });

    // Mock the data loader to return empty data
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [],
      },
    });

    render(
      <VisualizationWidget
        widget={widget}
        selection={mockSelection}
        renderErrorMessage={errorMessage => <div>{errorMessage}</div>}
      />
    );

    // The component should handle empty data gracefully
    // and show the error message instead of throwing
    expect(screen.getByText(NO_PLOTTABLE_VALUES)).toBeInTheDocument();
  });
});
