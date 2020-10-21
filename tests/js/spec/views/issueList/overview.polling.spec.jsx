import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import IssueList from 'app/views/issueList/overview';
import StreamGroup from 'app/components/stream/group';
import TagStore from 'app/stores/tagStore';

// Mock <IssueListSidebar> (need <IssueListActions> to toggling real time polling)
jest.mock('app/views/issueList/sidebar', () => jest.fn(() => null));
jest.mock('app/views/issueList/filters', () => jest.fn(() => null));
jest.mock('app/components/stream/group', () => jest.fn(() => null));

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
  let wrapper;

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
  const createWrapper = async ({params, location, ...p} = {}) => {
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

    wrapper = mountWithTheme(
      <IssueList {...newRouter} {...defaultProps} {...p} />,
      routerContext
    );

    await Promise.resolve();
    jest.runAllTimers();
    wrapper.update();

    return wrapper;
  };

  beforeEach(function () {
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
    pollRequest = MockApiClient.addMockResponse({
      url: `http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
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
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
  });

  it('toggles polling for new issues', async function () {
    await createWrapper();

    expect(issuesRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // Should be called with default query
        data: expect.stringContaining('is%3Aunresolved'),
      })
    );

    // Enable real time control
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(1);
    wrapper.find('[data-test-id="realtime-control"]').simulate('click');

    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(0);

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(6001);
    expect(pollRequest).toHaveBeenCalledTimes(2);

    // Pauses
    wrapper.find('[data-test-id="realtime-control"]').simulate('click');
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(1);

    jest.advanceTimersByTime(12001);
    expect(pollRequest).toHaveBeenCalledTimes(2);
  });

  it('stops polling for new issues when endpoint returns a 401', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 401,
    });

    await createWrapper();

    // Enable real time control
    wrapper.find('[data-test-id="realtime-control"]').simulate('click');
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(0);

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });

  it('stops polling for new issues when endpoint returns a 403', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 403,
    });

    await createWrapper();

    // Enable real time control
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(1);
    wrapper.find('[data-test-id="realtime-control"]').simulate('click');
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(0);

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });

  it('stops polling for new issues when endpoint returns a 404', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 404,
    });

    await createWrapper();

    // Enable real time control
    wrapper.find('[data-test-id="realtime-control"]').simulate('click');
    expect(wrapper.find('[data-test-id="realtime-control"] IconPlay')).toHaveLength(0);

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });
});
