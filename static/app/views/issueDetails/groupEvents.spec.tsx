import type {Location} from 'history';
import {GroupFixture} from 'sentry-fixture/group';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import GroupEvents from 'sentry/views/issueDetails/groupEvents';

let location: Location;

describe('groupEvents', () => {
  const requests: {[requestName: string]: jest.Mock} = {};
  const baseProps = Object.freeze({
    params: {orgId: 'orgId', groupId: '1'},
    route: {},
    routeParams: {},
    router: {} as any,
    routes: [],
    location: {},
    environments: [],
    group: GroupFixture() as Group,
  });

  let organization: Organization;
  let router;

  beforeEach(() => {
    browserHistory.push = jest.fn();

    ({organization, router} = initializeOrg({
      organization: {
        features: ['event-attachments'],
      },
    } as any));

    location = {
      pathname: '/organizations/org-slug/issues/123/events/',
      search: '',
      hash: '',
      action: 'REPLACE',
      key: 'okjkey',
      state: '',
      query: {
        query: '',
      },
    };

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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('fetches and renders a table of events', async () => {
    render(<GroupEvents {...baseProps} location={{...location, query: {}}} />, {
      router,
      organization,
    });

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

  it('handles search', async () => {
    render(<GroupEvents {...baseProps} location={{...location, query: {}}} />, {
      router,
      organization,
    });

    const list = [
      {searchTerm: '', expectedQuery: ''},
      {searchTerm: 'test', expectedQuery: 'test'},
      {searchTerm: 'environment:production test', expectedQuery: 'test'},
    ];

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const input = screen.getByPlaceholderText('Search for events, users, tags, and more');

    for (const item of list) {
      await userEvent.clear(input);
      await userEvent.paste(`${item.searchTerm}`);
      await userEvent.keyboard('[Enter>]');

      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: item.expectedQuery},
        })
      );
    }
  });

  it('pushes new query parameter when searching (issue-stream-search-query-builder)', async () => {
    render(<GroupEvents {...baseProps} location={{...location, query: {}}} />, {
      router,
      organization: {...organization, features: ['issue-stream-search-query-builder']},
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const input = screen.getByPlaceholderText('Search events...');

    await userEvent.click(input);
    await userEvent.keyboard('foo');
    await userEvent.keyboard('{enter}');

    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: 'foo'},
        })
      );
    });
  });

  it('displays event filters and tags (issue-stream-search-query-builder)', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      body: [{key: 'custom_tag', name: 'custom_tag', totalValues: 1}],
    });

    render(<GroupEvents {...baseProps} location={{...location, query: {}}} />, {
      router,
      organization: {...organization, features: ['issue-stream-search-query-builder']},
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const input = screen.getByPlaceholderText('Search events...');

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
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitFor(() => {
      expect(screen.getByText('transaction')).toBeInTheDocument();
    });
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({environment: ['prod', 'staging']}),
      })
    );
  });

  it('renders events table for performance issue', async () => {
    const group = GroupFixture();
    group.issueCategory = IssueCategory.PERFORMANCE;

    render(
      <GroupEvents
        {...baseProps}
        group={group}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'performance.issue_ids:1 event.type:transaction ',
        }),
      })
    );
    await waitFor(() => {
      expect(screen.getByText('transaction')).toBeInTheDocument();
    });
  });

  it('renders event and trace link correctly', async () => {
    const group = GroupFixture();
    group.issueCategory = IssueCategory.PERFORMANCE;

    render(
      <GroupEvents
        {...baseProps}
        group={group}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const eventIdATag = screen.getByText('id123').closest('a');
    expect(eventIdATag).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/1/events/id123/'
    );
  });

  it('does not make attachments request, async when feature not enabled', async () => {
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization: {...organization, features: []}}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const attachmentsColumn = screen.queryByText('attachments');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(requests.attachments).not.toHaveBeenCalled();
  });

  it('does not display attachments column with no attachments', async () => {
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const attachmentsColumn = screen.queryByText('attachments');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(requests.attachments).toHaveBeenCalled();
  });

  it('does not display minidump column with no minidumps', async () => {
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    const minidumpColumn = screen.queryByText('minidump');
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

    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const minidumpColumn = screen.queryByText('minidump');
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

    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    const attachmentsColumn = screen.queryByText('attachments');
    const minidumpColumn = screen.queryByText('minidump');
    expect(attachmentsColumn).not.toBeInTheDocument();
    expect(minidumpColumn).toBeInTheDocument();
    expect(requests.attachments).toHaveBeenCalled();
  });

  it('renders events table for error', async () => {
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'issue.id:1 ',
          field: expect.not.arrayContaining(['attachments', 'minidump']),
        }),
      })
    );

    await waitFor(() => {
      expect(screen.getByText('transaction')).toBeInTheDocument();
    });
  });

  it('removes sort if unsupported by the events table', async () => {
    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging'], sort: 'user'}}}
      />,
      {router, organization}
    );
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({query: expect.not.objectContaining({sort: 'user'})})
    );
    await waitFor(() => {
      expect(screen.getByText('transaction')).toBeInTheDocument();
    });
  });

  it('only request for a single projectId', async () => {
    const group = GroupFixture();

    render(
      <GroupEvents
        {...baseProps}
        group={group}
        location={{
          ...location,
          query: {
            environment: ['prod', 'staging'],
            sort: 'user',
            project: [group.project.id, '456'],
          },
        }}
      />,
      {router, organization}
    );
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({project: [group.project.id]}),
      })
    );
    await waitFor(() => {
      expect(screen.getByText('transaction')).toBeInTheDocument();
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

    render(
      <GroupEvents
        {...baseProps}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(screen.getByTestId('loading-error')).toHaveTextContent('Internal Error');
  });

  it('requests for backend columns if backend project', async () => {
    const group = GroupFixture();
    group.project.platform = 'node-express';
    render(
      <GroupEvents
        {...baseProps}
        group={group}
        location={{...location, query: {environment: ['prod', 'staging']}}}
      />,
      {router, organization}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(requests.discover).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: expect.arrayContaining(['url', 'runtime']),
        }),
      })
    );
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
