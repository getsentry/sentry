import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {GroupEvents} from 'sentry/views/organizationGroupDetails/groupEvents';

describe('groupEvents', function () {
  let request;
  let discoverRequest;
  let attachmentsRequest;

  const {organization, routerContext} = initializeOrg();

  beforeEach(function () {
    request = MockApiClient.addMockResponse({
      url: '/issues/1/events/',
      body: [
        TestStubs.Event({
          eventID: '12345',
          id: '1',
          message: 'ApiException',
          groupID: '1',
        }),
        TestStubs.Event({
          crashFile: {
            sha1: 'sha1',
            name: 'name.dmp',
            dateCreated: '2019-05-21T18:01:48.762Z',
            headers: {'Content-Type': 'application/octet-stream'},
            id: '12345',
            size: 123456,
            type: 'event.minidump',
          },
          culprit: '',
          dateCreated: '2019-05-21T18:00:23Z',
          'event.type': 'error',
          eventID: '123456',
          groupID: '1',
          id: '98654',
          location: 'main.js',
          message: 'TestException',
          platform: 'native',
          projectID: '123',
          tags: [{value: 'production', key: 'production'}],
          title: 'TestException',
        }),
      ],
    });

    browserHistory.push = jest.fn();
    discoverRequest = MockApiClient.addMockResponse({
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

    attachmentsRequest = MockApiClient.addMockResponse({
      url: '/api/0/issues/1/attachments/?per_page=50&types=event.minidump&event_id=id123',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders', function () {
    const wrapper = render(
      <GroupEvents
        organization={organization}
        api={new MockApiClient()}
        group={TestStubs.Group()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      {context: routerContext, organization}
    );

    expect(wrapper.container).toSnapshot();
  });

  it('handles search', function () {
    render(
      <GroupEvents
        organization={organization}
        api={new MockApiClient()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        group={TestStubs.Group()}
        location={{query: {}}}
      />,
      {context: routerContext, organization}
    );

    const list = [
      {searchTerm: '', expectedQuery: ''},
      {searchTerm: 'test', expectedQuery: 'test'},
      {searchTerm: 'environment:production test', expectedQuery: 'test'},
    ];

    const input = screen.getByPlaceholderText('Search events by id, message, or tags');

    for (const item of list) {
      userEvent.clear(input);
      userEvent.type(input, `${item.searchTerm}{enter}`);

      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: item.expectedQuery},
        })
      );
    }
  });

  it('handles environment filtering', function () {
    render(
      <GroupEvents
        organization={organization}
        api={new MockApiClient()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        group={TestStubs.Group()}
        location={{query: {environment: ['prod', 'staging']}}}
      />,
      {context: routerContext, organization}
    );
    expect(request).toHaveBeenCalledWith(
      '/issues/1/events/',
      expect.objectContaining({
        query: {limit: 50, query: '', environment: ['prod', 'staging']},
      })
    );
  });

  describe('When the performance flag is enabled', () => {
    let org;
    let group;

    beforeEach(() => {
      org = initializeOrg({
        organization: {features: ['performance-issues-all-events-tab']},
      });
      group = TestStubs.Group();
    });

    it('renders new events table for performance', function () {
      group.issueCategory = 'performance';

      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      expect(discoverRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'performance.issue_ids:1 event.type:transaction ',
          }),
        })
      );
      const perfEventsColumn = screen.getByText('transaction');
      expect(perfEventsColumn).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
    });

    it('renders event and trace link correctly', async () => {
      group.issueCategory = 'performance';

      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      await waitForElementToBeRemoved(document.querySelector('div.loading-indicator'));
      const eventIdATag = screen.getByText('id123').closest('a');
      const traceIdATag = screen.getByText('trace123').closest('a');
      expect(eventIdATag).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/1/events/id123/'
      );
      expect(traceIdATag).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/trace/trace123/?'
      );
    });

    it('does not display attachments column with no attachments', async () => {
      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      await waitForElementToBeRemoved(document.querySelector('div.loading-indicator'));
      const attachmentsColumn = screen.queryByText('attachments');
      expect(attachmentsColumn).not.toBeInTheDocument();
      expect(attachmentsRequest).toHaveBeenCalled();
    });

    it('does not display minidump column with no minidumps', async () => {
      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      await waitForElementToBeRemoved(document.querySelector('div.loading-indicator'));
      const minidumpColumn = screen.queryByText('minidump');
      expect(minidumpColumn).not.toBeInTheDocument();
    });

    it('displays minidumps', async () => {
      attachmentsRequest = MockApiClient.addMockResponse({
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
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      await waitForElementToBeRemoved(document.querySelector('div.loading-indicator'));
      const minidumpColumn = screen.queryByText('minidump');
      expect(minidumpColumn).toBeInTheDocument();
    });

    it('does not display attachments but displays minidump', async () => {
      attachmentsRequest = MockApiClient.addMockResponse({
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
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      await waitForElementToBeRemoved(document.querySelector('div.loading-indicator'));
      const attachmentsColumn = screen.queryByText('attachments');
      const minidumpColumn = screen.queryByText('minidump');
      expect(attachmentsColumn).not.toBeInTheDocument();
      expect(minidumpColumn).toBeInTheDocument();
      expect(attachmentsRequest).toHaveBeenCalled();
    });

    it('renders new events table if error', function () {
      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging']}}}
        />,
        {context: routerContext, organization}
      );
      expect(discoverRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'issue.id:1 ',
            field: expect.not.arrayContaining(['attachments', 'minidump']),
          }),
        })
      );

      const perfEventsColumn = screen.getByText('transaction');
      expect(perfEventsColumn).toBeInTheDocument();
    });

    it('removes sort if unsupported by the events table', function () {
      render(
        <GroupEvents
          organization={org.organization}
          api={new MockApiClient()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          group={group}
          location={{query: {environment: ['prod', 'staging'], sort: 'user'}}}
        />,
        {context: routerContext, organization}
      );
      expect(discoverRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({query: expect.not.objectContaining({sort: 'user'})})
      );
    });
  });

  it('does not renders new events table if error', function () {
    const org = initializeOrg();
    const group = TestStubs.Group();

    render(
      <GroupEvents
        organization={org.organization}
        api={new MockApiClient()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        group={group}
        location={{query: {environment: ['prod', 'staging']}}}
      />,
      {context: routerContext, organization}
    );

    const perfEventsColumn = screen.queryByText('transaction');
    expect(perfEventsColumn).not.toBeInTheDocument();
  });
});
