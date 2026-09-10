import {TransactionEventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {
  TraceMetaDataHeader,
  type TraceMetadataHeaderProps,
} from 'sentry/views/performance/newTraceDetails/traceHeader';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {Projects} from 'sentry/views/performance/newTraceDetails/traceHeader/projects';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {RootNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/rootNode';
import {TraceNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/traceNode';
import {UptimeCheckNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {
  makeEAPSpan,
  makeEAPTrace,
  makeUptimeCheck,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

jest.mock('sentry/views/performance/newTraceDetails/traceState/traceStateProvider');
jest.mock('sentry/views/performance/newTraceDetails/traceHeader/projects');

const baseProps: Partial<TraceMetadataHeaderProps> = {
  metaResults: {
    data: {
      errors: 1,
      performance_issues: 1,
      projects: 1,
      transactions: 1,
      transaction_child_count_map: {span1: 1},
      span_count: 1,
      span_count_map: {},
    },
    errors: [],
    isLoading: false,
    status: 'success',
  },
  rootEventResults: {
    data: TransactionEventFixture(),
  } as any,
  overview: {
    isProjectsLoading: false,
    isRepresentativeLoading: false,
    isTabLoading: false,
    projectIds: [],
    logs: {
      availability: 'absent',
      count: 0,
      representative: undefined,
    },
    metrics: {
      availability: 'absent',
      count: 0,
    },
  },
  tree: new TraceTree().build(),
  traceSlug: 'trace-slug',
};
let organization: Organization;

const projectsMock = jest.mocked(Projects);

describe('TraceMetaDataHeader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    projectsMock.mockReturnValue(<div />);

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/projects/',
    });

    organization = OrganizationFixture();
  });

  describe('breadcrumbs', () => {
    function renderHeader(
      props: TraceMetadataHeaderProps,
      location: RouterConfig['location'] = {
        pathname: '/organizations/org-slug/traces/trace/trace-slug',
      }
    ) {
      return render(
        <TopBar.Slot.Provider>
          <TopBar />
          <TraceMetaDataHeader {...props} organization={organization} />
        </TopBar.Slot.Provider>,
        {initialRouterConfig: {location}}
      );
    }

    it('should render module breadcrumbs', () => {
      const props = {...baseProps} as TraceMetadataHeaderProps;
      renderHeader(props, {
        pathname: '/organizations/org-slug/insights/backend/trace/trace-slug',
        query: {
          source: TraceViewSources.REQUESTS_MODULE,
        },
      });

      const topBar = screen.getByRole('banner');
      const breadcrumbsLinks = within(topBar).getAllByRole('link');
      expect(breadcrumbsLinks).toHaveLength(2);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Backend');
      expect(breadcrumbsLinks[1]).toHaveTextContent('Domain Summary');
      expect(
        within(topBar).getByRole('heading', {name: /trace-slug/})
      ).toBeInTheDocument();
    });

    it('should show insights from transaction summary with perf removal feature', () => {
      const props = {...baseProps} as TraceMetadataHeaderProps;
      renderHeader(props, {
        pathname: '/organizations/org-slug/traces/trace/123',
        query: {
          source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
          transaction: 'transaction-name',
        },
      });

      const topBar = screen.getByRole('banner');
      const breadcrumbsLinks = within(topBar).getAllByRole('link');
      expect(breadcrumbsLinks).toHaveLength(1);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsLinks[0]).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(
        within(topBar).getByRole('heading', {name: /trace-slug/})
      ).toBeInTheDocument();
    });

    it('should show insights from transaction summary', () => {
      const props = {...baseProps} as TraceMetadataHeaderProps;
      renderHeader(props, {
        pathname: '/organizations/org-slug/traces/trace/123',
        query: {
          source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
          transaction: 'transaction-name',
        },
      });

      const topBar = screen.getByRole('banner');
      const breadcrumbsLinks = within(topBar).getAllByRole('link');
      expect(breadcrumbsLinks).toHaveLength(1);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsLinks[0]).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(
        within(topBar).getByRole('heading', {name: /trace-slug/})
      ).toBeInTheDocument();
    });

    it('should render domain overview breadcrumbs', () => {
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/insights/frontend/trace/123',
            query: {
              source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
            },
          },
        },
      });

      const breadcrumbsLinks = screen.getAllByRole('link');
      const breadcrumbsItems = [screen.getByText(/trace-slug/)];

      expect(breadcrumbsLinks).toHaveLength(2);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Frontend');
      expect(breadcrumbsLinks[1]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsItems).toHaveLength(1);
      expect(breadcrumbsItems[0]).toHaveTextContent(/trace-slug/);
    });

    it('renders loading-state breadcrumbs in the top bar', () => {
      const pageFrameOrganization = OrganizationFixture();

      render(
        <TopBar.Slot.Provider>
          <TopBar.Slot.Outlet name="title">
            {props => <div {...props} data-test-id="topbar-title-slot" />}
          </TopBar.Slot.Outlet>
          <TraceMetaDataHeader
            {...({
              ...baseProps,
              metaResults: {
                data: undefined,
                errors: [],
                isLoading: true,
                status: 'pending',
              },
            } as TraceMetadataHeaderProps)}
            organization={pageFrameOrganization}
          />
        </TopBar.Slot.Provider>,
        {
          initialRouterConfig: {
            location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
          },
          organization: pageFrameOrganization,
        }
      );

      const topbarSlot = screen.getByTestId('topbar-title-slot');
      expect(within(topbarSlot).getByText(/trace-slug/)).toBeInTheDocument();
    });
  });

  describe('uptime check header', () => {
    it('should render uptime check header with title and subtitle', () => {
      // Create uptime check using test utility
      const uptimeCheckEvent = makeUptimeCheck({
        additional_attributes: {
          method: 'GET',
          request_url: 'https://example.com',
        },
      });

      const uptimeCheckWithContexts = {...uptimeCheckEvent, contexts: {}};

      // Create a tree structure that matches getRepresentativeTraceEvent expectations
      const tree = new TraceTree();

      // Create the tree root (this is tree.root)
      const treeRoot = new RootNode(null, null, {
        organization,
      });
      tree.root = treeRoot;

      // Create a mock trace node as first child of root
      const traceNodeValue = {
        transactions: [],
        orphan_errors: [],
      };
      const traceNode = new TraceNode(treeRoot, traceNodeValue, {
        organization,
      });
      treeRoot.children.push(traceNode);

      // Add uptime check as first child of trace node
      const uptimeCheckNode = new UptimeCheckNode(traceNode, uptimeCheckEvent, {
        organization,
      });
      traceNode.children.push(uptimeCheckNode);

      const props = {
        ...baseProps,
        tree,
        rootEventResults: {data: uptimeCheckWithContexts} as any,
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      // Check for uptime monitor title
      expect(screen.getByText('Uptime Monitor Check')).toBeInTheDocument();
      // Check for subtitle with method and URL
      expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
    });
  });

  describe('meta', () => {
    it('renders the core header while optional overview data is loading', () => {
      const overviewOrganization = OrganizationFixture({
        features: ['ourlogs-enabled', 'tracemetrics-enabled'],
      });
      const props = {
        ...baseProps,
        overview: {
          isProjectsLoading: true,
          isRepresentativeLoading: false,
          isTabLoading: true,
          projectIds: undefined,
          logs: {
            availability: 'loading',
            count: undefined,
            representative: undefined,
          },
          metrics: {
            availability: 'loading',
            count: undefined,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={overviewOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Issues')).toBeInTheDocument();
      expect(screen.getByText('Logs')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
    });

    it('keeps the core header for an empty tree while overview availability loads', () => {
      const overviewOrganization = OrganizationFixture({
        features: ['ourlogs-enabled', 'tracemetrics-enabled'],
      });
      const rootEventResults = {
        data: undefined,
        isLoading: false,
        status: 'pending',
      } as TraceRootEventQueryResults;
      const props = {
        ...baseProps,
        tree: TraceTree.Empty(),
        rootEventResults,
        overview: {
          isProjectsLoading: true,
          isRepresentativeLoading: true,
          isTabLoading: true,
          projectIds: undefined,
          logs: {
            availability: 'loading',
            count: undefined,
            representative: undefined,
          },
          metrics: {
            availability: 'loading',
            count: undefined,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={overviewOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Issues')).toBeInTheDocument();
      expect(screen.getByText('Logs')).toBeInTheDocument();
      expect(screen.getByText('Metrics')).toBeInTheDocument();
    });

    it('renders the core header when root event details fail', () => {
      const props = {
        ...baseProps,
        rootEventResults: {
          data: undefined,
          error: new Error('Trace item not found'),
          isLoading: false,
          status: 'error',
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Issues')).toBeInTheDocument();
      expect(screen.getByText('Spans')).toBeInTheDocument();
    });

    it('renders representative information for a log-only trace', () => {
      const logsOrganization = OrganizationFixture({
        features: ['ourlogs-enabled'],
      });
      const projects = [
        ProjectFixture({id: '1', slug: 'project-one'}),
        ProjectFixture({id: '2', slug: 'project-two'}),
      ];
      ProjectsStore.loadInitialData(projects);
      const representativeLog = {
        [OurLogKnownFieldKey.MESSAGE]: 'Representative log message',
        [OurLogKnownFieldKey.PROJECT_ID]: '1',
        [OurLogKnownFieldKey.SEVERITY]: 'info',
      } as NonNullable<
        TraceMetadataHeaderProps['overview']['logs']['representative']
      >[number];
      const representativeLogs = [representativeLog];
      const tree = TraceTree.Empty();
      const findRepresentativeTraceNode = jest
        .spyOn(tree, 'findRepresentativeTraceNode')
        .mockReturnValue({event: representativeLog, dataset: null});
      const props = {
        ...baseProps,
        tree,
        overview: {
          isProjectsLoading: false,
          isRepresentativeLoading: false,
          isTabLoading: false,
          projectIds: ['1', '2'],
          logs: {
            availability: 'present',
            count: 4,
            representative: representativeLogs,
          },
          metrics: {
            availability: 'absent',
            count: 0,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={logsOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Representative log message')).toBeInTheDocument();
      expect(screen.getByText('Logs')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(findRepresentativeTraceNode).toHaveBeenCalledWith({
        logs: representativeLogs,
      });
      expect(projectsMock.mock.calls[0]?.[0]).toEqual({
        projectSlugs: ['project-one', 'project-two'],
      });
    });

    it('should render logs count from trace meta before logs have loaded', () => {
      const logsOrganization = OrganizationFixture({
        features: ['ourlogs-enabled'],
      });

      const props = {
        ...baseProps,
        logs: undefined,
        metaResults: {
          ...baseProps.metaResults,
          data: {
            errorsCount: 0,
            logsCount: 5,
            metricsCount: 0,
            performanceIssuesCount: 0,
            spansCount: 0,
            spansCountMap: {},
            transactionChildCountMap: {},
            uptimeCount: 0,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={logsOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Logs')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render metrics count', () => {
      const metricsOrganization = OrganizationFixture({
        features: ['tracemetrics-enabled'],
      });

      const props = {
        ...baseProps,
        metrics: {count: 5},
        metaResults: {
          ...baseProps.metaResults,
          data: {
            errorsCount: 0,
            logsCount: 0,
            metricsCount: 5,
            performanceIssuesCount: 0,
            spansCount: 0,
            spansCountMap: {},
            transactionChildCountMap: {},
            uptimeCount: 0,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={metricsOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not render metrics count when the metrics feature is disabled', () => {
      const props = {
        ...baseProps,
        metrics: {count: 5},
        metaResults: {
          ...baseProps.metaResults,
          data: {
            errorsCount: 0,
            logsCount: 0,
            metricsCount: 5,
            performanceIssuesCount: 0,
            spansCount: 0,
            spansCountMap: {},
            transactionChildCountMap: {},
            uptimeCount: 0,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
    });

    it('should render meta with different spans count', async () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'eap-span-1',
            op: 'http',
            description: 'request',
            start_timestamp: 0,
            end_timestamp: 1,
            is_transaction: false,
            children: [],
          }),
        ]),
        {
          meta: null,
          replay: null,
          organization,
        }
      );

      const props = {
        ...baseProps,
        tree,
        metaResults: {
          ...baseProps.metaResults,
          data: {
            ...baseProps.metaResults?.data,
            span_count: 20,
          },
        },
      } as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByText('20')).toBeInTheDocument();
      await userEvent.hover(screen.getByText('20'));
      expect(await screen.findByText('Showing 1 of 20 spans')).toBeInTheDocument();
    });
  });
});
