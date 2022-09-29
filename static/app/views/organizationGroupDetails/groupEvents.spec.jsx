import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupEvents} from 'sentry/views/organizationGroupDetails/groupEvents';

describe('groupEvents', function () {
  let request;
  let discoverRequest;

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
    it('renders new events table for performance', function () {
      const org = initializeOrg({
        organization: {features: ['performance-issues-all-events-tab']},
      });
      const group = TestStubs.Group();
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
          query: expect.objectContaining({query: 'performance.issue_ids:1 '}),
        })
      );
      const perfEventsColumn = screen.getByText('transaction');
      expect(perfEventsColumn).toBeInTheDocument();
    });

    it('renders new events table if error', function () {
      const org = initializeOrg({
        organization: {features: ['performance-issues-all-events-tab']},
      });
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
      expect(discoverRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({query: expect.objectContaining({query: 'issue.id:1 '})})
      );

      const perfEventsColumn = screen.getByText('transaction');
      expect(perfEventsColumn).toBeInTheDocument();
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
