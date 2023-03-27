import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GroupTagValues from 'sentry/views/issueDetails/groupTagValues';

const group = TestStubs.Group();
const tags = TestStubs.Tags();

function init(tagKey) {
  return initializeOrg({
    organization: {},
    project: undefined,
    projects: undefined,
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
      url: '/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('navigates to issue details events tab with correct query params', async () => {
    const {routerContext, router, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: TestStubs.TagValues(),
    });
    render(<GroupTagValues environments={[]} group={group} project={project} />, {
      context: routerContext,
    });

    await userEvent.click(screen.getByLabelText('Show more'));
    await userEvent.click(screen.getByText('Search All Issues with Tag Value'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {query: 'user.username:david'},
    });
  });

  it('renders an error message if no tag values are returned because of environment selection', () => {
    const {routerContext, project} = init('user');

    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: [],
    });
    const {container} = render(
      <GroupTagValues environments={['staging']} group={group} project={project} />,
      {context: routerContext}
    );

    expect(container).toHaveTextContent(
      'No tags were found for the currently selected environments'
    );
  });
});
