import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import GroupTagValues from 'sentry/views/issueDetails/groupTagValues';

const group = TestStubs.Group();
const tags = TestStubs.Tags();

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

  it('navigates to issue details events tab with correct query params', async () => {
    const {routerProps, routerContext, router, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: TestStubs.TagValues(),
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

    await userEvent.click(screen.getByRole('button', {name: 'More'}));
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

  it('renders an error message if no tag values are returned because of environment selection', () => {
    const {routerProps, routerContext, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/user/values/',
      body: [],
    });
    const {container} = render(
      <GroupTagValues
        environments={['staging']}
        group={group}
        project={project}
        baseUrl=""
        {...routerProps}
      />,
      {context: routerContext}
    );

    expect(container).toHaveTextContent(
      'No tags were found for the currently selected environments'
    );
  });
});
