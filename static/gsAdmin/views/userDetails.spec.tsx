import {notifyManager} from '@tanstack/react-query';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {UserDetails} from 'admin/views/userDetails';

describe('User Details', () => {
  const mockUser = UserFixture({
    username: 'test-username',
    email: 'test-email@gmail.com',
    isActive: true,
  });

  beforeEach(() => {
    // Use synchronous scheduling to avoid React 19 act() timing issues
    // with TanStack Query's default setTimeout-based batching
    notifyManager.setScheduler(cb => cb());
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/users/${mockUser.id}/`,
      body: mockUser,
    });

    MockApiClient.addMockResponse({
      url: `/_admin/cells/us/users/${mockUser.id}/customers/`,
      body: [{}],
    });

    MockApiClient.addMockResponse({
      url: '/api-tokens/',
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

  afterEach(() => {
    // Restore default scheduler
    notifyManager.setScheduler(setTimeout);
  });

  describe('page rendering', () => {
    it('renders correct sections', async () => {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      expect(await screen.findByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getByText('User Emails')).toBeInTheDocument();
    });

    it('renders correct dropdown options for active account', async () => {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Users Actions'}))[0]!
      );
      expect(screen.getByText('Merge Accounts')).toBeInTheDocument();
      expect(screen.queryByTestId('action-reactivate')).not.toBeInTheDocument();
    });

    it('renders correct UserOverview', async () => {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      expect(await screen.findByText('test-username')).toBeInTheDocument();
      expect(screen.getByText('test-email@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Revoke')).toBeInTheDocument();
    });
  });

  describe('suspension', () => {
    it('shows Suspend Account action for active users', async () => {
      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${mockUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Users Actions'}))[0]!
      );
      expect(screen.getByText('Suspend Account')).toBeInTheDocument();
      expect(screen.queryByText('Unsuspend Account')).not.toBeInTheDocument();
    });

    it('shows Unsuspend Account action and Suspended badge for suspended users', async () => {
      const suspendedUser = UserFixture({
        ...mockUser,
        isSuspended: true,
      });
      MockApiClient.addMockResponse({
        url: `/users/${suspendedUser.id}/`,
        body: suspendedUser,
      });

      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${suspendedUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      const suspendedElements = await screen.findAllByText('Suspended');
      expect(suspendedElements).toHaveLength(2);

      await userEvent.click(screen.getAllByRole('button', {name: 'Users Actions'})[0]!);
      expect(screen.getByText('Unsuspend Account')).toBeInTheDocument();
      expect(screen.queryByText('Suspend Account')).not.toBeInTheDocument();
    });

    it('hides Reactivate Account when user is suspended', async () => {
      const suspendedInactiveUser = UserFixture({
        ...mockUser,
        isActive: false,
        isSuspended: true,
      });
      MockApiClient.addMockResponse({
        url: `/users/${suspendedInactiveUser.id}/`,
        body: suspendedInactiveUser,
      });

      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${suspendedInactiveUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Users Actions'}))[0]!
      );
      expect(screen.getByText('Unsuspend Account')).toBeInTheDocument();
      expect(screen.queryByText('Reactivate Account')).not.toBeInTheDocument();
    });

    it('shows Suspended status in user overview', async () => {
      const suspendedUser = UserFixture({
        ...mockUser,
        isSuspended: true,
      });
      MockApiClient.addMockResponse({
        url: `/users/${suspendedUser.id}/`,
        body: suspendedUser,
      });

      render(<UserDetails />, {
        initialRouterConfig: {
          location: {
            pathname: `/admin/users/${suspendedUser.id}/`,
          },
          route: '/admin/users/:userId/',
        },
      });

      const suspendedElements = await screen.findAllByText('Suspended');
      expect(suspendedElements).toHaveLength(2);
    });
  });
});
