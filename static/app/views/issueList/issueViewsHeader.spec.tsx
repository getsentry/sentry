import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import IssueViewsHeader from 'sentry/views/issueList/issueViewsHeader';

describe('IssueViewsHeader', function () {
  const view = GroupSearchViewFixture();

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/123/',
      method: 'GET',
      body: view,
    });
  });

  const defaultProps = {
    selectedProjectIds: [],
    title: 'Issues',
    realtimeActive: false,
    onRealtimeChange: jest.fn(),
  };

  const organization = OrganizationFixture({
    access: ['org:read'],
    features: ['enforce-stacked-navigation'],
  });

  const onIssueViewRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/views/123/',
    },
    route: '/organizations/:orgId/issues/views/:viewId/',
  };

  const onIssueFeedRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/',
    },
    route: '/organizations/:orgId/issues/',
  };

  ConfigStore.set('user', {
    ...ConfigStore.get('user'),
    options: {
      ...ConfigStore.get('user').options,
      prefersStackedNavigation: true,
    },
  });

  describe('edit menu', function () {
    it('does not render if not on a view', async function () {
      render(<IssueViewsHeader {...defaultProps} />, {
        organization,

        initialRouterConfig: onIssueFeedRouterConfig,
      });

      await screen.findByText('Issues');
      expect(screen.queryByRole('button', {name: 'Edit View'})).not.toBeInTheDocument();
    });

    it('can delete a view', async function () {
      const mockDeleteView = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/123/',
        method: 'DELETE',
      });

      const {router} = render(<IssueViewsHeader {...defaultProps} />, {
        organization,

        initialRouterConfig: onIssueViewRouterConfig,
      });
      renderGlobalModal();

      await userEvent.click(
        await screen.findByRole('button', {name: 'More issue view options'})
      );

      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Delete View'})
      );

      const confirmButton = await within(screen.getByRole('dialog')).findByRole(
        'button',
        {
          name: 'Delete View',
        }
      );

      await userEvent.click(confirmButton);

      // Should navigate back to the issue feed
      await waitFor(() => {
        expect(router.location.pathname).toBe('/organizations/org-slug/issues/');
      });

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Delete endpoint called
      expect(mockDeleteView).toHaveBeenCalled();
    });

    it('disables the delete button if the user does not have permission to delete views', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/123/',
        method: 'GET',
        body: GroupSearchViewFixture({
          createdBy: UserFixture({
            id: '34625', // Someone else
          }),
        }),
      });

      render(<IssueViewsHeader {...defaultProps} />, {
        organization,

        initialRouterConfig: onIssueViewRouterConfig,
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'More issue view options'})
      );

      expect(
        await screen.findByRole('menuitemradio', {name: 'Delete View'})
      ).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
