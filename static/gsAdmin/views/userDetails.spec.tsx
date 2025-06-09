import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import UserDetails from 'admin/views/userDetails';

describe('User Details', function () {
  const mockUser = UserFixture({
    username: 'test-username',
    email: 'test-email@gmail.com',
    isActive: true,
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/users/${mockUser.id}/`,
      body: mockUser,
    });

    MockApiClient.addMockResponse({
      url: `/users/${mockUser.id}/customers/`,
      body: [{}],
    });

    MockApiClient.addMockResponse({
      url: `/api-tokens/`,
      body: [
        {
          id: '8',
          scopes: ['event:read', 'member:read', 'org:read', 'project:read', 'team:read'],
          dateCreated: '2023-02-01T19:28:07.765250Z',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: `/users/${mockUser.id}/user-identities/`,
      body: [],
    });
  });

  describe('page rendering', function () {
    it('renders correct sections', async function () {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: `/admin/users/:userId/`,
        },
      });

      expect(await screen.findByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('User Emails')).toBeInTheDocument();
    });

    it('renders correct dropdown options for active account', async function () {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: `/admin/users/:userId/`,
        },
      });

      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Users Actions'}))[0]!
      );
      expect(screen.getByText('Merge Accounts')).toBeInTheDocument();
      expect(screen.queryByTestId('action-reactivate')).not.toBeInTheDocument();
    });

    it('renders correct UserOverview', async function () {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: `/admin/users/:userId/`,
        },
      });

      expect(await screen.findByText('test-username')).toBeInTheDocument();
      expect(screen.getByText('test-email@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Revoke')).toBeInTheDocument();
    });
  });
});
