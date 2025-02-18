import {TransactionEventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {
  TraceMetaDataHeader,
  type TraceMetadataHeaderProps,
} from 'sentry/views/performance/newTraceDetails/traceHeader';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

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
      span_count: 0,
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
};
let organization: Organization;

const useLocationMock = jest.mocked(useLocation);

describe('TraceMetaDataHeader', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    organization = OrganizationFixture();
  });

  describe('breadcrumbs', () => {
    it('should render module breadcrumbs', () => {
      useLocationMock.mockReturnValue(
        LocationFixture({
          pathname: '/organizations/org-slug/insights/backend/trace/123',
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
      expect(breadcrumbsItems[0]).toHaveTextContent('Trace View');
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
      organization.features.push('insights-performance-landing-removal');
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
      expect(breadcrumbsItems[1]).toHaveTextContent('Trace View');
    });

    it('should show performance from transaction summary', () => {
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

      expect(breadcrumbsLinks).toHaveLength(2);
      expect(breadcrumbsLinks[0]).toHaveTextContent('Performance');
      expect(breadcrumbsLinks[0]).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(breadcrumbsLinks[1]).toHaveTextContent('Transaction Summary');
      expect(breadcrumbsLinks[1]).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/summary?source=performance_transaction_summary&transaction=transaction-name'
      );
      expect(breadcrumbsItems).toHaveLength(1);
      expect(breadcrumbsItems[0]).toHaveTextContent('Trace View');
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
      expect(breadcrumbsItems[0]).toHaveTextContent('Trace View');
    });
  });
});
