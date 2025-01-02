import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import GroupEvents from 'sentry/views/issueDetails/groupEvents';

describe('groupEvents', () => {
  const requests: {[requestName: string]: jest.Mock} = {};
  let group!: Group;
  let organization: Organization;
  let router: ReturnType<typeof RouterFixture>;

  beforeEach(() => {
    group = GroupFixture();
    organization = OrganizationFixture({features: ['event-attachments']});
    router = RouterFixture({
      params: {orgId: 'org-slug', groupId: group.id},
      location: LocationFixture({
        pathname: '/organizations/org-slug/issues/123/events/',
        action: 'REPLACE',
        key: 'okjkey',
        query: {
          query: '',
        },
      }),
    });

    requests.discover = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link: `<https://sentry.io/api/0/issues/1/events/?limit=50&cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", <https://sentry.io/api/0/issues/1/events/?limit=50&cursor=0:200:0>; rel="next"; results="true"; cursor="0:200:0"`,
      },
      body: {
        data: [
          {
            timestamp: '2022-09-11T15:01:10+00:00',
            transaction: '/api',
            release: 'backend@1.2.3',
            'transaction.duration': 1803,
            environment: 'prod',
            'user.display': 'sentry@sentry.sentry',
            id: 'id123',
            trace: 'trace123',
            'project.name': 'project123',
          },
        ],
        meta: {
          fields: {
            timestamp: 'date',
            transaction: 'string',
            release: 'string',
            'transaction.duration': 'duration',
            environment: 'string',
            'user.display': 'string',
            id: 'string',
            trace: 'string',
            'project.name': 'string',
          },
          units: {
            timestamp: null,
            transaction: null,
            release: null,
            'transaction.duration': 'millisecond',
            environment: null,
            'user.display': null,
            id: null,
            trace: null,
            'project.name': null,
          },
          isMetricsData: false,
          tips: {query: null, columns: null},
        },
      },
    });

    requests.attachments = MockApiClient.addMockResponse({
      url: '/api/0/issues/1/attachments/?per_page=50&types=event.minidump&event_id=id123',
      body: [],
    });

    requests.recentSearches = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });

    requests.latestEvent = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/issues/1/events/latest/',
      body: {},
    });

    requests.tags = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/issues/1/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('fetches and renders a table of events', async () => {
    render(<GroupEvents />, {router, organization});

    expect(await screen.findByText('id123')).toBeInTheDocument();

    // Transaction
    expect(screen.getByText('/api')).toBeInTheDocument();
    // Environment
    expect(screen.getByText('prod')).toBeInTheDocument();
    // Release
    expect(screen.getByText('1.2.3')).toBeInTheDocument();
    // User email
    expect(screen.getByText('sentry@sentry.sentry')).toBeInTheDocument();
  });

  it('pushes new query parameter when searching', async () => {
    render(<GroupEvents />, {organization, router});

    const input = await screen.findByPlaceholderText('Search events\u2026');

    await userEvent.click(input);
    await userEvent.keyboard('foo');
    await userEvent.keyboard('{enter}');

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: 'foo'},
        })
      );
    });
  });

  it('displays event filters and tags', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      body: [{key: 'custom_tag', name: 'custom_tag', totalValues: 1}],
    });

    render(<GroupEvents />, {organization, router});

    const input = await screen.findByPlaceholderText('Search events\u2026');

    await userEvent.click(input);

    expect(
      await screen.findByRole('button', {name: 'Event Filters'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Event Tags'})).toBeInTheDocument();

    // Should show custom_tag fetched from group tags
    expect(screen.getByRole('option', {name: 'custom_tag'})).toBeInTheDocument();

    // Should hardcoded event filters
    expect(screen.getByRole('option', {name: 'event.type'})).toBeInTheDocument();
  });

  it('handles environment filtering', async () => {
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization});

    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({environment: ['prod', 'staging']}),
        })
      );
    });
    expect(await screen.findByText('Transaction')).toBeInTheDocument();
  });

  it('renders events table for performance issue', async () => {
    group.issueCategory = IssueCategory.PERFORMANCE;
    router.location.query.environment = ['prod', 'staging'];

    render(<GroupEvents />, {router, organization});

    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'performance.issue_ids:1 event.type:transaction ',
          }),
        })
      );
    });
    expect(await screen.findByText('Transaction')).toBeInTheDocument();
  });

  it('renders event and trace link correctly', async () => {
    group.issueCategory = IssueCategory.PERFORMANCE;
    router.location.query.environment = ['prod', 'staging'];

    render(<GroupEvents />, {router, organization});

    const eventIdATag = (await screen.findByText('id123')).closest('a');
    expect(eventIdATag).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/events/id123/'
    );
  });

  it('does not make attachments request, async when feature not enabled', async () => {
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization: {...organization, features: []}});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const attachmentsColumn = screen.queryByText('Attachments');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(requests.attachments).not.toHaveBeenCalled();
  });

  it('does not display attachments column with no attachments', async () => {
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const attachmentsColumn = screen.queryByText('Attachments');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(requests.attachments).toHaveBeenCalled();
  });

  it('does not display minidump column with no minidumps', async () => {
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const minidumpColumn = screen.queryByText('Minidump');
    expect(minidumpColumn).not.toBeInTheDocument();
  });

  it('displays minidumps', async () => {
    requests.attachments = MockApiClient.addMockResponse({
      url: '/api/0/issues/1/attachments/?per_page=50&types=event.minidump&event_id=id123',
      body: [
        {
          id: 'id123',
          name: 'dc42a8b9-fc22-4de1-8a29-45b3006496d8.dmp',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          mimetype: 'application/octet-stream',
          size: 1294340,
          sha1: '742127552a1191f71fcf6ba7bc5afa0a837350e2',
          dateCreated: '2022-09-28T09:04:38.659307Z',
          type: 'event.minidump',
          event_id: 'd54cb9246ee241ffbdb39bf7a9fafbb7',
        },
      ],
    });

    render(<GroupEvents />, {router, organization});
    const minidumpColumn = await screen.findByText('Minidump');
    expect(minidumpColumn).toBeInTheDocument();
  });

  it('does not display attachments but displays minidump', async () => {
    requests.attachments = MockApiClient.addMockResponse({
      url: '/api/0/issues/1/attachments/?per_page=50&types=event.minidump&event_id=id123',
      body: [
        {
          id: 'id123',
          name: 'dc42a8b9-fc22-4de1-8a29-45b3006496d8.dmp',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          mimetype: 'application/octet-stream',
          size: 1294340,
          sha1: '742127552a1191f71fcf6ba7bc5afa0a837350e2',
          dateCreated: '2022-09-28T09:04:38.659307Z',
          type: 'event.minidump',
          event_id: 'd54cb9246ee241ffbdb39bf7a9fafbb7',
        },
      ],
    });
    router.location.query.environment = ['prod', 'staging'];

    render(<GroupEvents />, {router, organization});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const minidumpColumn = await screen.findByText('Minidump');
    expect(minidumpColumn).toBeInTheDocument();
    const attachmentsColumn = screen.queryByText('Attachments');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(requests.attachments).toHaveBeenCalled();
  });

  it('renders events table for error', async () => {
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization});
    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'issue.id:1 ',
            field: expect.not.arrayContaining(['attachments', 'minidump']),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Transaction')).toBeInTheDocument();
    });
  });

  it('removes sort if unsupported by the events table', async () => {
    router.location.query = {
      ...router.location.query,
      environment: ['prod', 'staging'],
      sort: 'user',
    };
    render(<GroupEvents />, {router, organization});
    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({query: expect.not.objectContaining({sort: 'user'})})
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Transaction')).toBeInTheDocument();
    });
  });

  it('only request for a single projectId', async () => {
    router.location.query = {
      ...router.location.query,
      environment: ['prod', 'staging'],
      sort: 'user',
      project: [group.project.id, '456'],
    };
    render(<GroupEvents />, {router, organization});
    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({project: [group.project.id]}),
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Transaction')).toBeInTheDocument();
    });
  });

  it('shows discover query error message', async () => {
    requests.discover = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      statusCode: 500,
      body: {
        detail: 'Internal Error',
        errorId: '69ab396e73704cdba9342ff8dcd59795',
      },
    });
    router.location.query.environment = ['prod', 'staging'];

    render(<GroupEvents />, {router, organization});

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('loading-error')).toHaveTextContent('Internal Error');
  });

  it('requests for backend columns if backend project', async () => {
    group.project.platform = 'node-express';
    router.location.query.environment = ['prod', 'staging'];
    render(<GroupEvents />, {router, organization});

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    await waitFor(() => {
      expect(requests.discover).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: expect.arrayContaining(['url', 'runtime']),
          }),
        })
      );
    });
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.not.arrayContaining(['browser']),
        }),
      })
    );
  });
});
