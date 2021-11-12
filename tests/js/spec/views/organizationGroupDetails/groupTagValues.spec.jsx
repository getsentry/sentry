import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GroupTagValues from 'app/views/organizationGroupDetails/groupTagValues';

describe('GroupTagValues', () => {
  const {routerContext, router, project} = initializeOrg({});
  const group = TestStubs.Group();
  const tags = TestStubs.Tags();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('navigates to issue details events tab with correct query params', () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: TestStubs.TagValues(),
    });
    mountWithTheme(
      <GroupTagValues
        group={group}
        project={project}
        environments={[]}
        location={{query: {}}}
        params={{orgId: 'org-slug', groupId: group.id, tagKey: 'user'}}
      />,
      {context: routerContext}
    );

    userEvent.click(screen.getByLabelText('Show more'));
    userEvent.click(screen.getByText('Search All Issues with Tag Value'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {query: 'user.username:david'},
    });
  });

  it('renders an error message if no tag values are returned because of environment selection', () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: [],
    });
    const {container} = mountWithTheme(
      <GroupTagValues
        group={group}
        project={project}
        location={{query: {}}}
        params={{
          orgId: 'org-slug',
          groupId: group.id,
          tagKey: 'user',
        }}
        environments={['staging']}
      />,
      {context: routerContext}
    );

    expect(container).toHaveTextContent(
      'No tags were found for the currently selected environments'
    );
  });
});
