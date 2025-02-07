import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {MemberFixture} from 'sentry-fixture/member';
import {SearchFixture} from 'sentry-fixture/search';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import StreamGroup from 'sentry/components/stream/group';
import TagStore from 'sentry/stores/tagStore';
import IssueList from 'sentry/views/issueList/overview';

jest.mock('sentry/views/issueList/filters', () => jest.fn(() => null));
jest.mock('sentry/components/stream/group', () =>
  jest.fn(({id}) => <div data-test-id={id} />)
);

jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const PREVIOUS_PAGE_CURSOR = '1443575731';
const DEFAULT_LINKS_HEADER =
  `<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1>; rel="previous"; results="false"; cursor="${PREVIOUS_PAGE_CURSOR}:0:1", ` +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

describe('IssueList -> Polling', function () {
  let issuesRequest: jest.Mock;
  let pollRequest: jest.Mock;

  afterEach(() => {
    jest.useRealTimers();
    MockApiClient.clearMockResponses();
  });

  const {organization, project, routerProps} = initializeOrg({
    organization: {
      access: ['project:releases'],
    },
  });
  const savedSearch = SearchFixture({
    id: '789',
    query: 'is:unresolved',
    name: 'Unresolved Issues',
  });

  const group = GroupFixture({project});
  const group2 = GroupFixture({project, id: '2'});

  const defaultProps = {
    location: LocationFixture({
      query: {query: 'is:unresolved'},
      search: 'query=is:unresolved',
    }),
    params: {},
    organization,
  };

  /* helpers */
  const renderComponent = async () => {
    render(<IssueList {...routerProps} {...defaultProps} />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {query: 'is:unresolved'},
        },
      },
    });

    await Promise.resolve();
    jest.runAllTimers();
  };

  beforeEach(function () {
    jest.useFakeTimers();

    // The tests fail because we have a "component update was not wrapped in act" error.
    // It should be safe to ignore this error, but we should remove the mock once we move to react testing library

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
      body: TagsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [MemberFixture({projects: [project.slug]})],
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
        'X-Hits': '1',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [GroupStatsFixture()],
    });
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
        'X-Hits': '1',
      },
    });

    jest.mocked(StreamGroup).mockClear();
    TagStore.init();
  });

  it('toggles polling for new issues', async function () {
    await renderComponent();

    await waitFor(() => {
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aunresolved'),
        })
      );
    });

    // Enable realtime updates
    await userEvent.click(
      screen.getByRole('button', {name: 'Enable real-time updates'}),
      {delay: null}
    );

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(6001);
    expect(pollRequest).toHaveBeenCalledTimes(2);

    // Pauses
    await userEvent.click(screen.getByRole('button', {name: 'Pause real-time updates'}), {
      delay: null,
    });

    jest.advanceTimersByTime(12001);
    expect(pollRequest).toHaveBeenCalledTimes(2);
  });

  it('displays new group and pagination caption correctly', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [group2],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
        'X-Hits': '2',
      },
    });

    await renderComponent();
    expect(
      await screen.findByText(textWithMarkupMatcher('1-1 of 1'))
    ).toBeInTheDocument();

    // Enable realtime updates
    await userEvent.click(
      screen.getByRole('button', {name: 'Enable real-time updates'}),
      {delay: null}
    );

    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);

    // We mock out the stream group component and only render the ID as a testid
    await screen.findByTestId('2');

    expect(screen.getByText(textWithMarkupMatcher('1-2 of 2'))).toBeInTheDocument();
  });

  it('stops polling for new issues when endpoint returns a 401', async function () {
    pollRequest = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/issues/?cursor=${PREVIOUS_PAGE_CURSOR}:0:1`,
      body: [],
      statusCode: 401,
    });

    await renderComponent();

    // Enable real time control
    await userEvent.click(
      await screen.findByRole('button', {name: 'Enable real-time updates'}),
      {delay: null}
    );

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
    await userEvent.click(
      await screen.findByRole('button', {name: 'Enable real-time updates'}),
      {delay: null}
    );

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
    await userEvent.click(
      await screen.findByRole('button', {name: 'Enable real-time updates'}),
      {delay: null}
    );

    // Each poll request gets delayed by additional 3s, up to max of 60s
    jest.advanceTimersByTime(3001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(9001);
    expect(pollRequest).toHaveBeenCalledTimes(1);
  });
});
