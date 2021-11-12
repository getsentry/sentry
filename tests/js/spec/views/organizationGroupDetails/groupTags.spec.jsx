import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GroupTags from 'app/views/organizationGroupDetails/groupTags';

describe('GroupTags', function () {
  const {routerContext, router, organization} = initializeOrg();
  const group = TestStubs.Group();
  let tagsMock;
  beforeEach(function () {
    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.Tags(),
    });
  });

  it('navigates to issue details events tab with correct query params', function () {
    mountWithTheme(
      <GroupTags
        group={group}
        environments={['dev']}
        location={{}}
        baseUrl={`/organizations/${organization.slug}/issues/${group.id}/`}
      />,
      {context: routerContext}
    );

    expect(tagsMock).toHaveBeenCalledWith(
      '/issues/1/tags/',
      expect.objectContaining({
        query: {environment: ['dev']},
      })
    );

    const headers = screen.getAllByRole('heading').map(header => header.innerHTML);
    // Check headers have been sorted alphabetically
    expect(headers).toEqual(['browser', 'device', 'environment', 'url', 'user']);

    userEvent.click(screen.getByText('david'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/1/events/',
      query: {query: 'user.username:david'},
    });
  });
});
