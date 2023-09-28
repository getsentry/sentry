import {Tags} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GroupTags from 'sentry/views/issueDetails/groupTags';

describe('GroupTags', function () {
  const {routerProps, routerContext, router, organization} = initializeOrg();
  const group = TestStubs.Group();
  let tagsMock;
  beforeEach(function () {
    tagsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      body: Tags(),
    });
  });

  it('navigates to issue details events tab with correct query params', async function () {
    render(
      <GroupTags
        {...routerProps}
        group={group}
        environments={['dev']}
        baseUrl={`/organizations/${organization.slug}/issues/${group.id}/`}
      />,
      {context: routerContext, organization}
    );

    expect(tagsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1/tags/',
      expect.objectContaining({
        query: {environment: ['dev']},
      })
    );

    const headers = screen.getAllByTestId('tag-title').map(header => header.innerHTML);
    // Check headers have been sorted alphabetically
    expect(headers).toEqual(['browser', 'device', 'environment', 'url', 'user']);

    await userEvent.click(screen.getByText('david'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/1/events/',
      query: {query: 'user.username:david'},
    });
  });
});
