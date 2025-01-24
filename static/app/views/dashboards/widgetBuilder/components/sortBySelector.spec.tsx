import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const {organization, router} = initializeOrg({
  organization: {features: ['global-views', 'open-membership', 'dashboards-eap']},
  projects: [],
  router: {
    location: {
      pathname: '/organizations/org-slug/dashboard/1/',
      query: {
        displayType: 'line',
        fields: ['transaction.duration', 'count()', 'id'],
        yAxis: ['count()', 'count_unique(transaction.duration)'],
      },
    },
    params: {},
  },
});

const mockUseNavigate = jest.mocked(useNavigate);

describe('WidgetBuilderSortBySelector', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/spans/fields/',
      body: [],
    });
  });

  it('renders', async function () {
    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
    expect(await screen.findByText('Limit to 5 results')).toBeInTheDocument();
    expect(await screen.findByText('High to low')).toBeInTheDocument();
    expect(await screen.findByText('(Required)')).toBeInTheDocument();
  });

  it('renders correct fields for table widgets', async function () {
    const tableRouter = RouterFixture({
      ...router,
      location: {
        ...router.location,
        query: {...router.location.query, displayType: 'table'},
      },
    });

    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {
        router: tableRouter,
        organization,
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
    expect(await screen.findByText('High to low')).toBeInTheDocument();
    expect(await screen.findByText(`Select a column\u{2026}`)).toBeInTheDocument();
  });

  it('renders and functions correctly', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {router, organization}
    );

    const sortDirectionSelector = await screen.findByText('High to low');
    const sortFieldSelector = await screen.findByText('(Required)');

    expect(sortFieldSelector).toBeInTheDocument();

    await userEvent.click(sortFieldSelector);
    await userEvent.click(await screen.findByText('count()'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({sort: ['-count()']}),
      }),
      {replace: true}
    );

    await userEvent.click(sortDirectionSelector);
    await userEvent.click(await screen.findByText('Low to high'));
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({sort: ['count()']}),
      }),
      {replace: true}
    );
  });

  it('renders the correct limit options', async function () {
    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {router, organization}
    );

    // default limit is 5
    expect(await screen.findByText('Limit to 5 results')).toBeInTheDocument();

    const moreAggregatesRouter = RouterFixture({
      ...router,
      location: {
        ...router.location,
        query: {
          ...router.location.query,
          yAxis: ['count()', 'count_unique(transaction.duration)', 'eps()'],
        },
      },
    });

    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {router: moreAggregatesRouter, organization}
    );

    // default limit changes to 3 since its the max limit for 3 aggregates
    expect(await screen.findByText('Limit to 3 results')).toBeInTheDocument();
  });

  it('correctly handles limit changes', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <WidgetBuilderSortBySelector />
        </SpanTagsProvider>
      </WidgetBuilderProvider>,
      {router, organization}
    );

    const limitSelector = await screen.findByText('Limit to 5 results');
    await userEvent.click(limitSelector);
    await userEvent.click(await screen.findByText('Limit to 3 results'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({limit: 3}),
      }),
      {replace: true}
    );
  });
});
