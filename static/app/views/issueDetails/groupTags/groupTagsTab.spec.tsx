import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {GroupTagsTab} from './groupTagsTab';

describe('GroupTagsTab', () => {
  const group = GroupFixture();
  const organization = OrganizationFixture();
  let tagsMock: jest.Mock;

  const makeInitialRouterConfig = () => ({
    location: {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      query: {
        environment: 'dev',
      },
    },
    route: '/organizations/:orgId/issues/:groupId/tags/',
  });

  beforeEach(() => {
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

  it('navigates to issue details events tab with correct query params', async () => {
    const {router} = render(<GroupTagsTab />, {
      initialRouterConfig: makeInitialRouterConfig(),
      organization,
    });

    const headers = await screen.findAllByTestId('tag-title');

    expect(tagsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1/tags/',
      expect.objectContaining({
        query: {environment: ['dev'], limit: 10},
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

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/1/events/');
    });
    expect(router.location.query.query).toBe('user.username:david');
    expect(router.location.query.environment).toBe('dev');
  });

  it('shows an error message when the request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/tags/',
      statusCode: 500,
    });

    render(<GroupTagsTab />, {
      initialRouterConfig: makeInitialRouterConfig(),
      organization,
    });

    expect(
      await screen.findByText('There was an error loading issue tags.')
    ).toBeInTheDocument();
  });
});
