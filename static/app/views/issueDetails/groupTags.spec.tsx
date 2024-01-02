import {Group as GroupFixture} from 'sentry-fixture/group';
import {Tags} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {IssueType} from 'sentry/types';
import GroupTags from 'sentry/views/issueDetails/groupTags';

describe('GroupTags', function () {
  const {routerProps, routerContext, router, organization} = initializeOrg();
  const group = GroupFixture();
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

    const headers = await screen.findAllByTestId('tag-title');

    expect(tagsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1/tags/',
      expect.objectContaining({
        query: {environment: ['dev']},
      })
    );
    // Check headers have been sorted alphabetically
    expect(headers.map(h => h.innerHTML)).toEqual([
      'browser',
      'device',
      'environment',
      'url',
      'user',
    ]);

    await userEvent.click(screen.getByText('david'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/1/events/',
      query: {query: 'user.username:david'},
    });
  });

  it('navigates correctly when duration regression issue > tags key is clicked', async function () {
    render(
      <GroupTags
        {...routerProps}
        group={{...group, issueType: IssueType.PERFORMANCE_ENDPOINT_REGRESSION}}
        environments={['dev']}
        baseUrl={`/organizations/${organization.slug}/issues/${group.id}/`}
      />,
      {context: routerContext, organization}
    );

    await screen.findAllByTestId('tag-title');
    await userEvent.click(screen.getByText('browser'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/performance/summary/tags/',
      query: expect.objectContaining({
        tagKey: 'browser',
      }),
    });
  });

  it('shows an error message when the request fails', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      statusCode: 500,
    });

    render(
      <GroupTags
        {...routerProps}
        group={group}
        environments={['dev']}
        baseUrl={`/organizations/${organization.slug}/issues/${group.id}/`}
      />,
      {context: routerContext, organization}
    );

    expect(
      await screen.findByText('There was an error loading issue tags.')
    ).toBeInTheDocument();
  });
});
