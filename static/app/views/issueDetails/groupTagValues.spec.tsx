import {Group} from 'sentry-fixture/group';
import {Tags} from 'sentry-fixture/tags';
import {TagValues} from 'sentry-fixture/tagvalues';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  within,
} from 'sentry-test/reactTestingLibrary';

import GroupTagValues from 'sentry/views/issueDetails/groupTagValues';

const group = Group();
const tags = Tags();

function init(tagKey: string) {
  return initializeOrg({
    router: {
      location: {
        query: {},
        pathname: '/organizations/:orgId/issues/:groupId/tags/:tagKey/',
      },
      params: {orgId: 'org-slug', groupId: group.id, tagKey},
    },
  });
}

describe('GroupTagValues', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a list of tag values', async () => {
    const {routerProps, routerContext, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValues(),
    });
    render(
      <GroupTagValues
        environments={[]}
        group={group}
        project={project}
        baseUrl=""
        {...routerProps}
      />,
      {context: routerContext}
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

    // Special case for user tag - column title changes to Affected Users
    expect(screen.getByText('Affected Users')).toBeInTheDocument();

    // Affected user column
    expect(screen.getByText('David Cramer')).toBeInTheDocument();
    // Percent column
    expect(screen.getByText('16.67%')).toBeInTheDocument();
    // Count column
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('navigates to issue details events tab with correct query params', async () => {
    const {routerProps, routerContext, router, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TagValues(),
    });
    render(
      <GroupTagValues
        environments={[]}
        group={group}
        project={project}
        baseUrl=""
        {...routerProps}
      />,
      {
        context: routerContext,
      }
    );

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
    const {routerProps, routerContext, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      statusCode: 500,
    });

    render(
      <GroupTagValues
        environments={['staging']}
        group={group}
        project={project}
        baseUrl=""
        {...routerProps}
      />,
      {context: routerContext}
    );

    expect(
      await screen.findByText('There was an error loading tag details')
    ).toBeInTheDocument();
  });

  it('renders an error message if no tag values are returned because of environment selection', async () => {
    const {routerProps, routerContext, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: [],
    });

    render(
      <GroupTagValues
        environments={['staging']}
        group={group}
        project={project}
        baseUrl=""
        {...routerProps}
      />,
      {context: routerContext}
    );

    expect(
      await screen.findByText(
        'No tags were found for the currently selected environments'
      )
    ).toBeInTheDocument();
  });
});
