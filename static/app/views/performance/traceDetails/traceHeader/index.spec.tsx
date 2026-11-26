import {TransactionEventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import {
  TraceMetaDataHeader,
  type TraceMetadataHeaderProps,
} from 'sentry/views/performance/traceDetails/traceHeader';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {RootNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/rootNode';
import {TraceNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/traceNode';
import {UptimeCheckNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/uptimeCheckNode';
import {
  makeEAPSpan,
  makeEAPTrace,
  makeUptimeCheck,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {TraceViewSources} from './traceViewSources';

jest.mock('sentry/views/performance/traceDetails/traceState/traceStateProvider');

const baseProps: Partial<TraceMetadataHeaderProps> = {
  metaResults: {
    data: {
      errorsCount: 1,
      logsCount: 0,
      metricsCount: 0,
      performanceIssuesCount: 1,
      spansCount: 1,
      spansCountMap: {},
      uptimeCount: 0,
    },
    errors: [],
    isLoading: false,
    status: 'success',
  },
  rootEventResults: {data: TransactionEventFixture()} as any,
  overview: {
    isProjectsLoading: false,
    isRepresentativeLoading: false,
    isTabLoading: false,
    projectIds: [],
    logs: {availability: 'absent', count: 0, representative: undefined},
    metrics: {availability: 'absent', count: 0},
  },
  tree: new TraceTree().build(),
  traceSlug: 'trace-slug',
};
let organization: Organization;

// Outside a <main>, the EntityHeader's <header> is a banner too; the TopBar is
// the one holding the page's <h1>.
function getTopBar() {
  const topBar = screen
    .getAllByRole('banner')
    .find(banner => within(banner).queryByRole('heading', {level: 1}));
  expect(topBar).toBeDefined();
  return topBar!;
}

function TestHeader(props: TraceMetadataHeaderProps) {
  return (
    <TopBar.Slot.Provider>
      <TopBar />
      <TraceMetaDataHeader {...props} organization={organization} />
    </TopBar.Slot.Provider>
  );
}

describe('TraceMetaDataHeader', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/projects/',
    });

    organization = OrganizationFixture();
  });

  describe('breadcrumbs', () => {
    it('should render module breadcrumbs', () => {
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TestHeader {...props} />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/insights/backend/trace/trace-slug',
            query: {source: TraceViewSources.REQUESTS_MODULE},
          },
        },
      });

      const topBar = getTopBar();
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
      render(<TestHeader {...props} />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/traces/trace/123',
            query: {
              source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
              transaction: 'transaction-name',
            },
          },
        },
      });

      const topBar = getTopBar();
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
      render(<TestHeader {...props} />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/traces/trace/123',
            query: {
              source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
              transaction: 'transaction-name',
            },
          },
        },
      });

      const topBar = getTopBar();
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
            query: {source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY},
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

  describe('loading, error, and empty states', () => {
    const location = {pathname: '/organizations/org-slug/traces/trace/trace-slug'};

    it('marks the header busy while the trace loads', () => {
      const props = {
        ...baseProps,
        metaResults: {data: undefined, errors: [], isLoading: true, status: 'pending'},
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {location},
      });

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');
    });

    it.each([
      ['the trace request fails', 'success'],
      ['the trace request fails before meta does', 'pending'],
    ] as const)('settles the header without stats when %s', (_, metaStatus) => {
      const props = {
        ...baseProps,
        tree: TraceTree.ErrorState(organization),
        metaResults: {
          ...baseProps.metaResults,
          isLoading: metaStatus === 'pending',
          status: metaStatus,
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {location},
      });

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'false');
      expect(screen.getByRole('heading', {level: 2})).toHaveAccessibleName(
        'Trace, Trace'
      );
      expect(screen.queryByRole('list', {name: 'Trace stats'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('list', {name: 'Trace properties'})
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('banner')).queryByTestId('loading-placeholder')
      ).not.toBeInTheDocument();
    });

    it('settles the header without stats for a trace with no events', () => {
      const props = {
        ...baseProps,
        tree: TraceTree.Empty(),
        metaResults: {
          ...baseProps.metaResults,
          data: {
            ...baseProps.metaResults?.data,
            errorsCount: 0,
            performanceIssuesCount: 0,
            spansCount: 0,
          },
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {location},
      });

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'false');
      expect(screen.getByRole('heading', {level: 2})).toHaveAccessibleName(
        'Trace, Trace'
      );
      expect(screen.queryByRole('list', {name: 'Trace stats'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('list', {name: 'Trace properties'})
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByRole('banner')).queryByTestId('loading-placeholder')
      ).not.toBeInTheDocument();
    });

    it('renders the loaded header when only the trace meta request fails', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'span-1',
            op: 'http.server',
            is_transaction: true,
            start_timestamp: 0,
            end_timestamp: 1,
            children: [],
          }),
        ]),
        {replay: null, organization}
      );
      const props = {
        ...baseProps,
        tree,
        metaResults: {data: undefined, errors: [], isLoading: false, status: 'error'},
        rootEventResults: {
          data: TransactionEventFixture({tags: [{key: 'environment', value: 'prod'}]}),
        } as any,
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {location},
      });

      expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'false');
      const stats = screen.getByRole('list', {name: 'Trace stats'});
      expect(within(stats).getByText('Spans')).toBeInTheDocument();
      expect(within(stats).getByText('1')).toBeInTheDocument();
      expect(within(stats).getByText('Issues')).toBeInTheDocument();
      expect(
        within(screen.getByRole('list', {name: 'Trace properties'})).getByText('prod')
      ).toBeInTheDocument();
    });
  });

  describe('uptime check header', () => {
    it('should render uptime check header with title and subtitle', () => {
      // Create uptime check using test utility
      const uptimeCheckEvent = makeUptimeCheck({
        additional_attributes: {method: 'GET', request_url: 'https://example.com'},
      });

      const uptimeCheckWithContexts = {...uptimeCheckEvent, contexts: {}};

      // Create a tree structure that matches getRepresentativeTraceEvent expectations
      const tree = new TraceTree();

      // Create the tree root (this is tree.root)
      const treeRoot = new RootNode(null, null, {organization});
      tree.root = treeRoot;

      // Create a mock trace node as first child of root
      const traceNodeValue: TraceTree.EAPTrace = [];
      const traceNode = new TraceNode(treeRoot, traceNodeValue, {organization});
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

      expect(
        screen.getByRole('heading', {level: 2, name: 'Trace, GET https://example.com'})
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole('list', {name: 'Trace properties'})).getByText(
          'Uptime Monitor Check'
        )
      ).toBeInTheDocument();
    });

    it('shows the region an uptime check ran from', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([makeUptimeCheck({event_id: 'check-1'})]),
        {replay: null, organization}
      );

      const props = {
        ...baseProps,
        tree,
        rootEventResults: {
          data: {
            itemId: 'check-1',
            timestamp: '2024-01-01T00:00:00Z',
            meta: {},
            attributes: [{name: 'region', type: 'str', value: 'us-east-1'}],
          },
        } as any,
      } as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(
        within(screen.getByRole('list', {name: 'Trace properties'})).getByText(
          'Check from us-east-1'
        )
      ).toBeInTheDocument();
    });

    it('does not show a region attribute on a span as an uptime check region', () => {
      const tree = TraceTree.FromTrace(
        makeEAPTrace([
          makeEAPSpan({
            event_id: 'span-1',
            op: 'http.server',
            is_transaction: true,
            start_timestamp: 0,
            end_timestamp: 1,
            children: [],
          }),
        ]),
        {replay: null, organization}
      );

      const props = {
        ...baseProps,
        tree,
        rootEventResults: {
          data: {
            itemId: 'span-1',
            timestamp: '2024-01-01T00:00:00Z',
            meta: {},
            attributes: [
              {name: 'region', type: 'str', value: 'us-east-1'},
              {name: 'environment', type: 'str', value: 'production'},
            ],
          },
        } as any,
      } as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      const metadata = screen.getByRole('list', {name: 'Trace properties'});
      expect(within(metadata).getByText('production')).toBeInTheDocument();
      expect(within(metadata).queryByText(/us-east-1/)).not.toBeInTheDocument();
      expect(within(metadata).queryByText('Uptime check region')).not.toBeInTheDocument();
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
          logs: {availability: 'loading', count: undefined, representative: undefined},
          metrics: {availability: 'loading', count: undefined},
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={overviewOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      const stats = screen.getByRole('list', {name: 'Trace stats'});
      expect(within(stats).getByText('Issues')).toBeInTheDocument();
      // Logs and Metrics hold their slots as skeletons until their counts land.
      expect(within(stats).queryByText('Logs')).not.toBeInTheDocument();
      expect(within(stats).queryByText('Metrics')).not.toBeInTheDocument();
      expect(within(stats).getAllByTestId('loading-placeholder')).toHaveLength(2);
    });

    it('holds the header as a skeleton for an empty tree while the representative event loads', () => {
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
          logs: {availability: 'loading', count: undefined, representative: undefined},
          metrics: {availability: 'loading', count: undefined},
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={overviewOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(screen.getByRole('heading', {level: 2})).toHaveAccessibleName('Trace');
      expect(screen.getByRole('list', {name: 'Trace stats'})).toBeInTheDocument();
      expect(screen.queryByText('Issues')).not.toBeInTheDocument();
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
      const logsOrganization = OrganizationFixture({features: ['ourlogs-enabled']});
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
        metaResults: {
          ...baseProps.metaResults,
          data: {
            ...baseProps.metaResults?.data,
            errorsCount: 0,
            logsCount: 4,
            performanceIssuesCount: 0,
            spansCount: 0,
          },
        },
        overview: {
          isProjectsLoading: false,
          isRepresentativeLoading: false,
          isTabLoading: false,
          projectIds: ['1', '2'],
          logs: {availability: 'present', count: 4, representative: representativeLogs},
          metrics: {availability: 'absent', count: 0},
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={logsOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(
        screen.getByRole('heading', {level: 2, name: 'Trace, Representative log message'})
      ).toBeInTheDocument();
      const stats = screen.getByRole('list', {name: 'Trace stats'});
      expect(within(stats).getByText('Logs')).toBeInTheDocument();
      expect(within(stats).getByText('4')).toBeInTheDocument();
      expect(findRepresentativeTraceNode).toHaveBeenCalledWith({
        logs: representativeLogs,
      });
      expect(
        screen.getByRole('img', {name: 'Projects: project-one, project-two'})
      ).toBeInTheDocument();
    });

    it('should render logs count from trace meta before logs have loaded', () => {
      const logsOrganization = OrganizationFixture({features: ['ourlogs-enabled']});

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
        {replay: null, organization}
      );

      const props = {
        ...baseProps,
        tree,
        metaResults: {
          ...baseProps.metaResults,
          data: {...baseProps.metaResults?.data, spansCount: 20},
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

    it('links the root event replay in the metadata', () => {
      const props = {
        ...baseProps,
        rootEventResults: {
          data: TransactionEventFixture({
            contexts: {
              replay: {replay_id: '761104e184c64d439ee1014b72b4d83b', type: 'replay'},
            },
          }),
        } as any,
      } as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      const metadata = screen.getByRole('list', {name: 'Trace properties'});
      expect(
        within(metadata).getByRole('link', {name: 'Replay 761104e1'})
      ).toHaveAttribute(
        'href',
        '/organizations/org-slug/explore/replays/761104e184c64d439ee1014b72b4d83b/'
      );
      expect(
        within(screen.getByRole('list', {name: 'Trace stats'})).queryByText('Replays')
      ).not.toBeInTheDocument();
    });

    it('renders root event properties as metadata', () => {
      const props = {
        ...baseProps,
        rootEventResults: {
          data: TransactionEventFixture({
            contexts: {browser: {name: 'Chrome', version: '120.0'}},
            tags: [{key: 'environment', value: 'production'}],
          }),
        } as any,
      } as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      const metadata = screen.getByRole('list', {name: 'Trace properties'});
      expect(within(metadata).getByText('Chrome')).toBeInTheDocument();
      expect(within(metadata).getByText('120.0')).toBeInTheDocument();
      expect(within(metadata).getByText('production')).toBeInTheDocument();
    });

    describe('metadata row while loading', () => {
      const location = {pathname: '/organizations/org-slug/traces/trace/trace-slug'};
      const pendingMeta = {
        data: undefined,
        errors: [],
        isLoading: true,
        status: 'pending',
      } as TraceMetadataHeaderProps['metaResults'];
      const idleRootEvent = {
        data: undefined,
        isLoading: false,
        status: 'pending',
        fetchStatus: 'idle',
      } as TraceRootEventQueryResults;
      const fetchingRootEvent = {
        data: undefined,
        isLoading: true,
        status: 'pending',
        fetchStatus: 'fetching',
      } as TraceRootEventQueryResults;

      function getMetadataRow() {
        const row = screen.queryByRole('list', {name: 'Trace properties'});
        if (!row) {
          return null;
        }
        const skeletons = within(row).queryAllByTestId('loading-placeholder').length;
        return {
          skeletons,
          items: within(row).getAllByRole('listitem').length - skeletons,
        };
      }

      it('keeps a stable metadata row while a log-only trace loads', () => {
        const logsOrganization = OrganizationFixture({features: ['ourlogs-enabled']});
        ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'project-one'})]);
        const representativeLog = {
          [OurLogKnownFieldKey.ID]: 'log-1',
          [OurLogKnownFieldKey.MESSAGE]: 'Representative log message',
          [OurLogKnownFieldKey.PROJECT_ID]: '1',
          [OurLogKnownFieldKey.SEVERITY]: 'info',
        } as NonNullable<
          TraceMetadataHeaderProps['overview']['logs']['representative']
        >[number];
        const tree = TraceTree.Empty();
        const findRepresentativeTraceNode = jest
          .spyOn(tree, 'findRepresentativeTraceNode')
          .mockReturnValue(null);
        const loadedMeta = {
          ...baseProps.metaResults,
          data: {
            ...baseProps.metaResults?.data,
            errorsCount: 0,
            logsCount: 4,
            performanceIssuesCount: 0,
            spansCount: 0,
          },
        } as TraceMetadataHeaderProps['metaResults'];
        const loadedOverview = {
          isProjectsLoading: false,
          isRepresentativeLoading: false,
          isTabLoading: false,
          projectIds: ['1'],
          logs: {availability: 'present', count: 4, representative: [representativeLog]},
          metrics: {availability: 'absent', count: 0},
        } as TraceMetadataHeaderProps['overview'];
        const props = {...baseProps, tree} as TraceMetadataHeaderProps;
        const phases: Array<ReturnType<typeof getMetadataRow>> = [];

        // 1. Trace meta is still loading.
        const {rerender} = render(
          <TraceMetaDataHeader
            {...props}
            metaResults={pendingMeta}
            overview={{...loadedOverview, isRepresentativeLoading: true}}
            rootEventResults={idleRootEvent}
            organization={logsOrganization}
          />,
          {initialRouterConfig: {location}}
        );
        phases.push(getMetadataRow());

        // 2. The trace has no spans, so the representative log is fetched.
        rerender(
          <TraceMetaDataHeader
            {...props}
            metaResults={loadedMeta}
            overview={{
              ...loadedOverview,
              isRepresentativeLoading: true,
              logs: {...loadedOverview.logs, representative: undefined},
            }}
            rootEventResults={idleRootEvent}
            organization={logsOrganization}
          />
        );
        phases.push(getMetadataRow());

        // 3. The representative log is known, and its details are fetched.
        findRepresentativeTraceNode.mockReturnValue({
          event: representativeLog,
          dataset: TraceItemDataset.LOGS,
        });
        rerender(
          <TraceMetaDataHeader
            {...props}
            metaResults={loadedMeta}
            overview={loadedOverview}
            rootEventResults={fetchingRootEvent}
            organization={logsOrganization}
          />
        );
        phases.push(getMetadataRow());

        // 4. The root event has loaded.
        rerender(
          <TraceMetaDataHeader
            {...props}
            metaResults={loadedMeta}
            overview={loadedOverview}
            rootEventResults={
              {
                data: {
                  itemId: 'log-1',
                  timestamp: '2024-01-01T00:00:00Z',
                  meta: {},
                  attributes: [
                    {name: 'environment', type: 'str', value: 'production'},
                    {name: 'os.name', type: 'str', value: 'Linux'},
                  ],
                },
                isLoading: false,
                status: 'success',
              } as any
            }
            organization={logsOrganization}
          />
        );
        phases.push(getMetadataRow());

        expect(phases).toEqual([
          {skeletons: 4, items: 0},
          {skeletons: 4, items: 0},
          {skeletons: 4, items: 0},
          {skeletons: 0, items: 2},
        ]);
        expect(
          screen.getByRole('heading', {
            level: 2,
            name: 'Trace, Representative log message',
          })
        ).toBeInTheDocument();
      });

      it('does not hold a span trace header for the root event', () => {
        const tree = TraceTree.FromTrace(
          makeEAPTrace([
            makeEAPSpan({
              event_id: 'span-1',
              op: 'http.server',
              description: 'GET /api',
              is_transaction: true,
              start_timestamp: 0,
              end_timestamp: 1,
              children: [],
            }),
          ]),
          {replay: null, organization}
        );
        const props = {...baseProps, tree} as TraceMetadataHeaderProps;
        const phases: Array<ReturnType<typeof getMetadataRow>> = [];

        const {rerender} = render(
          <TraceMetaDataHeader
            {...props}
            metaResults={pendingMeta}
            rootEventResults={idleRootEvent}
            organization={organization}
          />,
          {initialRouterConfig: {location}}
        );
        phases.push(getMetadataRow());

        // Started comes from the tree, so the row already has its height
        // while the root event loads.
        rerender(
          <TraceMetaDataHeader
            {...props}
            rootEventResults={fetchingRootEvent}
            organization={organization}
          />
        );
        phases.push(getMetadataRow());
        expect(screen.getByText('Spans')).toBeInTheDocument();

        rerender(
          <TraceMetaDataHeader
            {...props}
            rootEventResults={
              {
                data: {
                  itemId: 'span-1',
                  timestamp: '2024-01-01T00:00:00Z',
                  meta: {},
                  attributes: [{name: 'environment', type: 'str', value: 'production'}],
                },
                isLoading: false,
                status: 'success',
              } as any
            }
            organization={organization}
          />
        );
        phases.push(getMetadataRow());

        expect(phases).toEqual([
          {skeletons: 4, items: 0},
          {skeletons: 0, items: 1},
          {skeletons: 0, items: 2},
        ]);
      });

      it('stops loading a log-only trace when its root event fails', () => {
        const logsOrganization = OrganizationFixture({features: ['ourlogs-enabled']});
        const representativeLog = {
          [OurLogKnownFieldKey.MESSAGE]: 'Representative log message',
          [OurLogKnownFieldKey.SEVERITY]: 'info',
        } as NonNullable<
          TraceMetadataHeaderProps['overview']['logs']['representative']
        >[number];
        const tree = TraceTree.Empty();
        jest
          .spyOn(tree, 'findRepresentativeTraceNode')
          .mockReturnValue({event: representativeLog, dataset: TraceItemDataset.LOGS});

        render(
          <TraceMetaDataHeader
            {...({
              ...baseProps,
              tree,
              metaResults: {
                ...baseProps.metaResults,
                data: {...baseProps.metaResults?.data, logsCount: 1, spansCount: 0},
              },
              overview: {
                ...baseProps.overview,
                logs: {
                  availability: 'present',
                  count: 1,
                  representative: [representativeLog],
                },
              },
              rootEventResults: {
                data: undefined,
                error: new Error('Trace item not found'),
                isLoading: false,
                status: 'error',
              },
            } as TraceMetadataHeaderProps)}
            organization={logsOrganization}
          />,
          {initialRouterConfig: {location}}
        );

        expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'false');
        expect(getMetadataRow()).toBeNull();
        expect(
          screen.getByRole('heading', {
            level: 2,
            name: 'Trace, Representative log message',
          })
        ).toBeInTheDocument();
      });
    });

    it('titles a log-only trace with its log message, without escape codes', () => {
      const logsOrganization = OrganizationFixture({features: ['ourlogs-enabled']});
      const representativeLog = {
        [OurLogKnownFieldKey.MESSAGE]: '\x1B[31mfailed\x1B[0m to connect',
        [OurLogKnownFieldKey.SEVERITY]: 'info',
      } as NonNullable<
        TraceMetadataHeaderProps['overview']['logs']['representative']
      >[number];
      const tree = TraceTree.Empty();
      jest
        .spyOn(tree, 'findRepresentativeTraceNode')
        .mockReturnValue({event: representativeLog, dataset: null});
      const props = {
        ...baseProps,
        tree,
        metaResults: {
          ...baseProps.metaResults,
          data: {...baseProps.metaResults?.data, logsCount: 1, spansCount: 0},
        },
        overview: {
          ...baseProps.overview,
          logs: {availability: 'present', count: 1, representative: [representativeLog]},
        },
      } as TraceMetadataHeaderProps;

      render(<TraceMetaDataHeader {...props} organization={logsOrganization} />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/traces/trace/trace-slug'},
        },
      });

      expect(
        screen.getByRole('heading', {level: 2, name: 'Trace, failed to connect'})
      ).toBeInTheDocument();
    });
  });
});
