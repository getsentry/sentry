import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useNavigate} from 'sentry/utils/useNavigate';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {ELLIPSIS} from 'sentry/views/insights/common/utils/centerTruncate';

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('WidgetBuilderSortBySelector', function () {
  let organization: Organization;
  let router: InjectedRouter<Record<string, string | undefined>, any>;
  beforeEach(function () {
    const setupOrg = initializeOrg({
      organization: {
        features: ['global-views', 'open-membership', 'visibility-explore-view'],
      },
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
    organization = setupOrg.organization;
    router = setupOrg.router;

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  it('renders for spans', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(await screen.findByText('Sort by')).toBeInTheDocument();
    expect(await screen.findByText('Limit to 5 results')).toBeInTheDocument();
    expect(await screen.findByText('High to low')).toBeInTheDocument();
    expect(await screen.findByText('(Required)')).toBeInTheDocument();
  });

  it('renders for logs', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router: tableRouter,
        organization,
        deprecatedRouterMocks: true,
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
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
      expect.anything()
    );

    await userEvent.click(sortDirectionSelector);
    await userEvent.click(await screen.findByText('Low to high'));
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({sort: ['count()']}),
      }),
      expect.anything()
    );
  });

  it('renders the correct limit options', async function () {
    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router: moreAggregatesRouter,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    // default limit changes to 3 since its the max limit for 3 aggregates
    expect(await screen.findByText('Limit to 3 results')).toBeInTheDocument();
  });

  it('correctly handles limit changes', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    const limitSelector = await screen.findByText('Limit to 5 results');
    await userEvent.click(limitSelector);
    await userEvent.click(await screen.findByText('Limit to 3 results'));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({limit: 3}),
      }),
      expect.anything()
    );
  });

  it('switches the default value for count_unique functions', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: [{key: 'span.duration', name: 'span.duration'}],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.attributeType === 'number';
        },
      ],
    });

    const setupOrg = initializeOrg({
      organization: {
        features: ['global-views', 'open-membership', 'visibility-explore-view'],
      },
      projects: [],
      router: {
        location: {
          pathname: '/organizations/org-slug/dashboard/1/',
          query: {
            displayType: 'line',
            fields: ['transaction.duration', 'count()', 'id'],
            yAxis: ['count()', 'count_unique(span.op)'],
            sort: ['-count(span.duration)'],
            dataset: 'spans',
          },
        },
        params: {},
      },
    });
    organization = setupOrg.organization;
    router = setupOrg.router;

    render(
      <WidgetBuilderProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <WidgetBuilderSortBySelector />
        </TraceItemAttributeProvider>
      </WidgetBuilderProvider>,
      {
        router,
        organization,
        deprecatedRouterMocks: true,
      }
    );

    expect(await screen.findByText(`count(${ELLIPSIS})`)).toBeInTheDocument();
    expect(screen.getByText('spans')).toBeInTheDocument();

    await userEvent.click(screen.getByText(`count(${ELLIPSIS})`));
    await userEvent.click(screen.getByText(`count_unique(${ELLIPSIS})`));

    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({sort: ['-count_unique(span.op)']}),
      }),
      expect.anything()
    );
  });
});
