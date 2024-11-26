import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SpanFixture} from 'sentry-fixture/span';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import SpanDetail from 'sentry/components/events/interfaces/spans/spanDetail';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import type {EventTransaction} from 'sentry/types/event';

describe('SpanDetail', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  const trace = {
    op: 'http.server',
    spans: [],
    traceID: '',
    traceStartTimestamp: 0,
    traceEndTimestamp: 0,
    childSpans: {},
    rootSpanID: '',
    rootSpanStatus: undefined,
  };

  const event = EventFixture({
    title: '/api/0/detail',
    projectID: project.id,
    startTimestamp: 0,
  }) as EventTransaction;

  const span = SpanFixture({
    op: 'db',
    hash: 'a',
    description: 'SELECT * FROM users;',
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
    });
  });

  function renderSpanDetail(props: Partial<React.ComponentProps<typeof SpanDetail>>) {
    return (
      <TransactionProfileIdProvider
        projectId={project.id}
        transactionId={event.id}
        timestamp={event.dateReceived}
      >
        <SpanDetail
          organization={organization}
          event={event}
          resetCellMeasureCache={jest.fn()}
          scrollToHash={jest.fn()}
          isRoot={false}
          relatedErrors={[]}
          trace={trace}
          childTransactions={[]}
          span={span}
          {...props}
        />
      </TransactionProfileIdProvider>
    );
  }

  describe('resource spans', function () {
    it('shows size fields', function () {
      render(
        renderSpanDetail({
          span: SpanFixture({
            op: 'resource.link',
            description: 'static.assets/content.js',
            data: {
              'http.response_content_length': 132,
              'http.response_transfer_size': 0,
              'http.decoded_response_content_length': null,
            },
          }),
        })
      );

      expect(
        screen.queryByText('http.decoded_response_content_length')
      ).not.toBeInTheDocument();
      expect(screen.getByText('http.response_transfer_size')).toBeInTheDocument();
      expect(screen.getByText('http.response_content_length')).toBeInTheDocument();
      expect(screen.getByText('132.0 B')).toBeInTheDocument();
    });
  });

  describe('http.client spans', function () {
    it('shows size fields for integer and string values', function () {
      render(
        renderSpanDetail({
          span: SpanFixture({
            op: 'http.client',
            description: 'POST /resources.json',
            data: {
              'http.response_content_length': '143',
              'http.request_content_length': 12,
            },
          }),
        })
      );

      expect(screen.getByText('http.response_content_length')).toBeInTheDocument();
      expect(screen.getByText('143.0 B')).toBeInTheDocument();

      expect(screen.getByText('http.request_content_length')).toBeInTheDocument();
      expect(screen.getByText('12.0 B')).toBeInTheDocument();
    });
  });

  describe('db spans', function () {
    it('renders "Similar Span" button but no Query Details button by default', function () {
      render(
        renderSpanDetail({
          span: SpanFixture({
            op: 'db',
            hash: 'a',
            description: 'SELECT * FROM users;',
          }),
        })
      );

      expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'View Similar Spans'})
      ).toBeInTheDocument();

      expect(
        screen.queryByRole('button', {name: 'View Query Summary'})
      ).not.toBeInTheDocument();
    });

    it('renders "View Query Details" button if "Queries" view is enabled and span group is available', function () {
      render(
        renderSpanDetail({
          span: SpanFixture({
            op: 'db',
            hash: 'a',
            description: 'SELECT * FROM users;',
            sentry_tags: {
              group: 'a7ebd21614897',
              category: 'db',
            },
          }),
          organization: OrganizationFixture({
            ...organization,
            features: ['insights-initial-modules'],
          }),
        })
      );

      expect(screen.getByText('SELECT * FROM users;')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'View Similar Spans'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'View Query Summary'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'View Query Summary'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/insights/backend/database/spans/span/a7ebd21614897/?project=2'
      );
    });
  });
});
