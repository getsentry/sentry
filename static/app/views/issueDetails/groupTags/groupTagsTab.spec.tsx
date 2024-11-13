import {GroupFixture} from 'sentry-fixture/group';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupTagsTab} from './groupTagsTab';

describe('GroupTagsTab', function () {
  const group = GroupFixture();
  const {router, organization} = initializeOrg({
    router: {
      location: {
        query: {
          environment: 'dev',
        },
      },
      params: {
        orgId: 'org-slug',
        groupId: group.id,
      },
    },
  });
  let tagsMock: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    tagsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
    });
  });

  it('navigates to issue details events tab with correct query params', async function () {
    render(<GroupTagsTab />, {router, organization});

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
      query: {query: 'user.username:david', environment: 'dev'},
    });
  });

  it('shows an error message when the request fails', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      statusCode: 500,
    });

    render(<GroupTagsTab />, {router, organization});

    expect(
      await screen.findByText('There was an error loading issue tags.')
    ).toBeInTheDocument();
  });
});
