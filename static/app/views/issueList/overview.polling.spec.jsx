import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'sentry/components/stream/group';
import TagStore from 'sentry/stores/tagStore';
import IssueList from 'sentry/views/issueList/overview';

jest.mock('sentry/views/issueList/filters', () => jest.fn(() => null));
jest.mock('sentry/components/stream/group', () => jest.fn(() => null));

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const PREVIOUS_PAGE_CURSOR = '1443575731';
const DEFAULT_LINKS_HEADER =
  `<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1>; rel="previous"; results="false"; cursor="${PREVIOUS_PAGE_CURSOR}:0:1", ` +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

jest.useFakeTimers();

describe('IssueList -> Polling', function () {
  let issuesRequest;
  let pollRequest;

  const {organization, project, router, routerContext} = initializeOrg({
    organization: {
      access: ['releases'],
    },
  });
  const savedSearch = TestStubs.Search({
    id: '789',
    query: 'is:unresolved',
    name: 'Unresolved Issues',
    projectId: project.id,
  });

  const group = TestStubs.Group({project});

  const defaultProps = {
    location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
    params: {orgId: organization.slug},
    organization,
  };

  /* helpers */
  const renderComponent = async ({params, location, ...p} = {}) => {
    const newRouter = {
      ...router,
      params: {
        ...router.params,
        ...params,
      },
      location: {
        ...router.location,
        ...location,
      },
    };

    render(<IssueList {...newRouter} {...defaultProps} {...p} />, {
      context: routerContext,
    });

    await Promise.resolve();
    jest.runAllTimers();
  };

  beforeEach(function () {
    // The tests fail because we have a "component update was not wrapped in act" error.
    // It should be safe to ignore this error, but we should remove the mock once we move to react testing library
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      method: 'GET',
      body: [{}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: TestStubs.Tags(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [TestStubs.Member({projects: [project.slug]})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
    });
    issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [group],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [TestStubs.GroupStats()],
    });
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });

    StreamGroup.mockClear();
    TagStore.init();
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('toggles polling for new issues', async function () {
    await renderComponent();

    expect(issuesRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // Should be called with default query
        data: expect.stringContaining('is%3Aunresolved'),
      })
    );

    // Enable realtime updates
    userEvent.click(screen.getByRole('button', {name: 'Enable real-time updates'}));

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(6001);
    expect(pollRequest).toHaveBeenCalledTimes(2);

    // Pauses
    userEvent.click(screen.getByRole('button', {name: 'Pause real-time updates'}));

    jest.advanceTimersByTime(12001);
    expect(pollRequest).toHaveBeenCalledTimes(2);
  });

  it('stops polling for new issues when endpoint returns a 401', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 401,
    });

    await renderComponent();

    // Enable real time control
    userEvent.click(screen.getByRole('button', {name: 'Enable real-time updates'}));

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });

  it('stops polling for new issues when endpoint returns a 403', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 403,
    });

    await renderComponent();

    // Enable real time control
    userEvent.click(screen.getByRole('button', {name: 'Enable real-time updates'}));

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });

  it('stops polling for new issues when endpoint returns a 404', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 404,
    });

    await renderComponent();

    // Enable real time control
    userEvent.click(screen.getByRole('button', {name: 'Enable real-time updates'}));

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });
});
