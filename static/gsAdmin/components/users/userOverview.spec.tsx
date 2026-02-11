import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {UserIdentityCategory, UserIdentityStatus} from 'sentry/types/auth';
import type {UserIdentityConfig} from 'sentry/types/auth';

import UserOverview from './userOverview';

describe('UserOverview', () => {
  const mockUser = UserFixture({
    username: 'test-user',
    email: 'test@example.com',
  });

  const mockProps = {
    user: mockUser,
    identities: [] as UserIdentityConfig[],
    tokens: [],
    onAuthenticatorRemove: jest.fn(),
    onIdentityDisconnect: jest.fn(),
    revokeToken: jest.fn(),
  };

  it('renders GitHub Copilot identity correctly', () => {
    const githubCopilotIdentity: UserIdentityConfig = {
      id: '123',
      category: UserIdentityCategory.GITHUB_COPILOT_IDENTITY,
      provider: {
        key: 'github_copilot',
        name: 'GitHub Copilot',
      },
      name: 'copilot-user',
      status: UserIdentityStatus.CAN_DISCONNECT,
      isLogin: false,
      dateAdded: '2024-01-01T00:00:00Z',
      dateSynced: null,
      dateVerified: null,
      organization: null,
    };

    render(<UserOverview {...mockProps} identities={[githubCopilotIdentity]} />);

    expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
    expect(screen.getByText('copilot-user')).toBeInTheDocument();
  });

  it('renders Global Login identity correctly', () => {
    const globalIdentity: UserIdentityConfig = {
      id: '456',
      category: UserIdentityCategory.GLOBAL_IDENTITY,
      provider: {
        key: 'google',
        name: 'Google',
      },
      name: 'google-user',
      status: UserIdentityStatus.CAN_DISCONNECT,
      isLogin: true,
      dateAdded: '2024-01-01T00:00:00Z',
      dateSynced: null,
      dateVerified: null,
      organization: null,
    };

    render(<UserOverview {...mockProps} identities={[globalIdentity]} />);

    expect(screen.getByText('Global Login')).toBeInTheDocument();
  });

  it('renders Social Identity correctly', () => {
    const socialIdentity: UserIdentityConfig = {
      id: '789',
      category: UserIdentityCategory.SOCIAL_IDENTITY,
      provider: {
        key: 'github',
        name: 'GitHub',
      },
      name: 'github-user',
      status: UserIdentityStatus.CAN_DISCONNECT,
      isLogin: false,
      dateAdded: '2024-01-01T00:00:00Z',
      dateSynced: null,
      dateVerified: null,
      organization: null,
    };

    render(<UserOverview {...mockProps} identities={[socialIdentity]} />);

    expect(screen.getByText('Legacy Integration')).toBeInTheDocument();
  });

  it('renders multiple identities correctly', () => {
    const identities: UserIdentityConfig[] = [
      {
        id: '1',
        category: UserIdentityCategory.GITHUB_COPILOT_IDENTITY,
        provider: {key: 'github_copilot', name: 'GitHub Copilot'},
        name: 'copilot-user',
        status: UserIdentityStatus.CAN_DISCONNECT,
        isLogin: false,
        dateAdded: '2024-01-01T00:00:00Z',
        dateSynced: null,
        dateVerified: null,
        organization: null,
      },
      {
        id: '2',
        category: UserIdentityCategory.GLOBAL_IDENTITY,
        provider: {key: 'google', name: 'Google'},
        name: 'google-user',
        status: UserIdentityStatus.CAN_DISCONNECT,
        isLogin: true,
        dateAdded: '2024-01-01T00:00:00Z',
        dateSynced: null,
        dateVerified: null,
        organization: null,
      },
    ];

    render(<UserOverview {...mockProps} identities={identities} />);

    expect(screen.getByText('GitHub Copilot')).toBeInTheDocument();
    expect(screen.getByText('Global Login')).toBeInTheDocument();
  });
});
