import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
} from 'sentry/views/dashboards/types';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

import {WidgetPreview} from './widgetPreview';

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('WidgetPreview', () => {
  const dashboard: DashboardDetails = {
    id: 'new',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '',
    widgets: [],
    projects: [],
    filters: {},
  };

  const renderOptions = {
    organization: OrganizationFixture(),
    additionalWrapper: WidgetBuilderProvider,
    initialRouterConfig: {
      location: {pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME},
    },
  };

  afterEach(() => PageFiltersStore.reset());

  function ExampleWidgetPreview({
    previewStatus,
  }: {
    previewStatus: Parameters<typeof WidgetPreview>[0]['previewStatus'];
  }) {
    return (
      <WidgetPreview
        dashboard={dashboard}
        dashboardFilters={{}}
        previewStatus={previewStatus}
      />
    );
  }

  it('renders a loading state when the preview status is loading', () => {
    render(<ExampleWidgetPreview previewStatus={{status: 'loading'}} />, renderOptions);
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders the error message when the preview status is invalid', () => {
    render(
      <ExampleWidgetPreview
        previewStatus={{status: 'invalid', message: 'This widget is broken.'}}
      />,
      renderOptions
    );
    expect(screen.getByText('This widget is broken.')).toBeInTheDocument();
  });

  it.each([0, 1])(
    'preserves duplicate series when series %s is smoothed',
    async index => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/stats/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {data: []},
      });
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            TimeSeriesFixture({yAxis: 'p90(span.duration)'}),
            TimeSeriesFixture({yAxis: 'p90(span.duration)'}),
          ],
        },
      });

      render(<WidgetPreview dashboard={dashboard} dashboardFilters={{}} />, {
        ...renderOptions,
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              dataset: WidgetType.SPANS,
              displayType: DisplayType.LINE,
              yAxis: ['p90(span.duration)', 'p90(span.duration)'],
              query: [''],
              transformations: JSON.stringify([{[index]: ['smooth(sma,5)']}]),
            },
          },
        },
      });

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(
          '/organizations/org-slug/events-timeseries/',
          expect.objectContaining({
            query: expect.objectContaining({
              yAxis: ['p90(span.duration)', 'p90(span.duration)'],
              [`transformations[${index}]`]: ['smooth(sma,5)'],
            }),
          })
        );
      });
      expect(
        await screen.findByLabelText('Toggle p90(span.duration)')
      ).toBeInTheDocument();
      expect(
        await screen.findByLabelText('Toggle p90(span.duration) · smooth(sma,5)')
      ).toBeInTheDocument();
    }
  );
});
