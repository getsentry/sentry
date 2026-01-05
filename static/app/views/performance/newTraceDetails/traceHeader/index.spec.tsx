import {TransactionEventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {
  TraceMetaDataHeader,
  type TraceMetadataHeaderProps,
} from 'sentry/views/performance/newTraceDetails/traceHeader';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
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
jest.mock('sentry/utils/useLocation');

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
    status: 'success',
  },
  rootEventResults: {
    data: TransactionEventFixture(),
  } as any,
  tree: new TraceTree().build(),
  traceEventView: EventView.fromSavedQuery({
    id: '1',
    name: 'test',
    fields: ['title', 'event.type', 'project', 'timestamp'],
    projects: [],
    version: 2,
  }),
  traceSlug: 'trace-slug',
};
let organization: Organization;

const useLocationMock = jest.mocked(useLocation);

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
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/insights/backend/trace/trace-slug',
          query: {
            source: TraceViewSources.REQUESTS_MODULE,
          },
        })
      );
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />);

      const breadcrumbs = screen.getByTestId('breadcrumb-list');
      const breadcrumbsLinks = screen.getAllByTestId('breadcrumb-link');
      const breadcrumbsItems = screen.getAllByTestId('breadcrumb-item');

      expect(breadcrumbs.childElementCount).toBe(5);

      expect(breadcrumbsLinks).toHaveLength(2);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Backend');
      expect(breadcrumbsLinks[1]).toHaveTextContent('Domain Summary');
      expect(breadcrumbsItems).toHaveLength(1);
      expect(breadcrumbsItems[0]).toHaveTextContent(/trace-slug/);
    });

    it('should show insights from transaction summary with perf removal feature', () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/traces/trace/123',
          query: {
            source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
            transaction: 'transaction-name',
          },
        })
      );
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />);

      const breadcrumbs = screen.getByTestId('breadcrumb-list');
      const breadcrumbsLinks = screen.getAllByTestId('breadcrumb-link');
      const breadcrumbsItems = screen.getAllByTestId('breadcrumb-item');

      expect(breadcrumbs.childElementCount).toBe(5);

      expect(breadcrumbsLinks).toHaveLength(1);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsLinks[0]).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(breadcrumbsItems).toHaveLength(2);
      expect(breadcrumbsItems[0]).toHaveTextContent('Insights');
      expect(breadcrumbsItems[1]).toHaveTextContent(/trace-slug/);
    });

    it('should show insights from transaction summary', () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/traces/trace/123',
          query: {
            source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
            transaction: 'transaction-name',
          },
        })
      );
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />);

      const breadcrumbs = screen.getByTestId('breadcrumb-list');
      const breadcrumbsLinks = screen.getAllByTestId('breadcrumb-link');
      const breadcrumbsItems = screen.getAllByTestId('breadcrumb-item');

      expect(breadcrumbs.childElementCount).toBe(5);

      expect(breadcrumbsLinks).toHaveLength(1);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsLinks[0]).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/summary?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(breadcrumbsItems).toHaveLength(2);
      expect(breadcrumbsItems[0]).toHaveTextContent('Insights');
      expect(breadcrumbsItems[1]).toHaveTextContent(/trace-slug/);
    });

    it('should render domain overview breadcrumbs', () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/insights/frontend/trace/123',
          query: {
            source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
          },
        })
      );
      const props = {...baseProps} as TraceMetadataHeaderProps;
      render(<TraceMetaDataHeader {...props} organization={organization} />);

      const breadcrumbs = screen.getByTestId('breadcrumb-list');
      const breadcrumbsLinks = screen.getAllByTestId('breadcrumb-link');
      const breadcrumbsItems = screen.getAllByTestId('breadcrumb-item');

      expect(breadcrumbs.childElementCount).toBe(5);

      expect(breadcrumbsLinks).toHaveLength(2);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Frontend');
      expect(breadcrumbsLinks[1]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsItems).toHaveLength(1);
      expect(breadcrumbsItems[0]).toHaveTextContent(/trace-slug/);
    });
  });

  describe('uptime check header', () => {
    it('should render uptime check header with title and subtitle', () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/traces/trace/trace-slug',
        })
      );

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

      render(<TraceMetaDataHeader {...props} organization={organization} />);

      // Check for uptime monitor title
      expect(screen.getByText('Uptime Monitor Check')).toBeInTheDocument();
      // Check for subtitle with method and URL
      expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
    });
  });

  describe('meta', () => {
    it('should render meta with different spans count', async () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/traces/trace/trace-slug',
        })
      );

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
      render(<TraceMetaDataHeader {...props} organization={organization} />);

      expect(screen.getByText('20')).toBeInTheDocument();
      await userEvent.hover(screen.getByText('20'));
      expect(await screen.findByText('Showing 1 of 20 spans')).toBeInTheDocument();
    });
  });
});
