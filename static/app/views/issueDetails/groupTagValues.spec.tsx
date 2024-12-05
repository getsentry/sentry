import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';
import {TagValuesFixture} from 'sentry-fixture/tagvalues';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {browserHistory} from 'sentry/utils/browserHistory';
import {GroupTagValues} from 'sentry/views/issueDetails/groupTagValues';

describe('GroupTagValues', () => {
  const group = GroupFixture();
  const tags = TagsFixture();
  const project = ProjectFixture();

  function init(tagKey: string, environment?: string[] | string) {
    return initializeOrg({
      router: {
        location: {
          query: {
            environment,
          },
          pathname: '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
        },
        params: {orgId: 'org-slug', groupId: group.id, tagKey},
      },
    });
  }

  beforeEach(() => {
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a list of tag values', async () => {
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<GroupTagValues />, {router});

    // Special case for user tag - column title changes to Affected Users
    expect(await screen.findByText('Affected Users')).toBeInTheDocument();

    // Affected user column
    expect(screen.getByText('David Cramer')).toBeInTheDocument();
    // Percent column
    expect(screen.getByText('16.67%')).toBeInTheDocument();
    // Count column
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('can page through tag values', async () => {
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
      headers: {
        Link:
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://sentry.io/api/0/organizations/sentry/user-feedback/?statsPeriod=14d&cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
    });
    render(<GroupTagValues />, {router});

    expect(await screen.findByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Next'})).toBeEnabled();

    // Clicking next button loads page with query param ?cursor=0:100:0
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({query: expect.objectContaining({cursor: '0:100:0'})})
      );
    });
  });

  it('navigates to issue details events tab with correct query params', async () => {
    const {router} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValuesFixture(),
    });
    render(<GroupTagValues />, {
      router,
    });

    await userEvent.click(await screen.findByRole('button', {name: 'More'}));
    await userEvent.click(
      within(
        screen.getByRole('menuitemradio', {name: 'Search All Issues with Tag Value'})
      ).getByRole('link')
    );

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {query: 'user.username:david'},
    });
  });

  it('renders an error message if tag values request fails', async () => {
    const {router} = init('user', 'staging');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      statusCode: 500,
    });

    render(<GroupTagValues />, {router});

    expect(
      await screen.findByText('There was an error loading tag details')
    ).toBeInTheDocument();
  });

  it('renders an error message if no tag values are returned because of environment selection', async () => {
    const {router} = init('user', 'staging');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: [],
    });

    render(<GroupTagValues />, {router});

    expect(
      await screen.findByText(
        'No tags were found for the currently selected environments'
      )
    ).toBeInTheDocument();
  });
});
