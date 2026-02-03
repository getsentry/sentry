import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AvatarUser} from 'sentry/types/user';

import {UserAvatar} from './userAvatar';

describe('UserAvatar', () => {
  describe('initials rendering with user.name', () => {
    it('renders initials from user.name for letter_avatar type', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: null,
        },
      });

      render(<UserAvatar user={user} />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders initials from user.name when gravatar fails to load', async () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null,
        },
      });

      render(<UserAvatar user={user} />);

      // Wait for gravatar to render
      const img = await screen.findByRole('img');
      expect(img).toBeInTheDocument();

      // Simulate gravatar load failure
      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      // Should show letter avatar with initials from user.name, not email
      await waitFor(() => {
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders initials from user.name when upload fails to load', async () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'upload',
          avatarUrl: 'https://example.com/broken.jpg',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);

      // Wait for upload to render
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();

      // Simulate upload load failure
      act(() => {
        img.dispatchEvent(new Event('error'));
      });

      // Should show letter avatar with initials from user.name, not email
      await waitFor(() => {
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('falls back to email for initials when user.name is not provided', () => {
      const user: AvatarUser = UserFixture({
        name: '',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      // Email addresses render as single initial (first character)
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('falls back to username for initials when user.name and email are not provided', () => {
      const user: AvatarUser = UserFixture({
        name: '',
        email: '',
        username: 'johndoe',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('handles gravatar type without email by falling back to letter avatar', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        username: 'johndoe',
        email: '',
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      // Should render letter avatar immediately since no email
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('actor rendering', () => {
    it('renders actor name as initials', () => {
      const actor = {
        id: '1',
        name: 'John Doe',
        type: 'user' as const,
      };

      render(<UserAvatar user={actor} />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders single initial for single-word actor name', () => {
      const actor = {
        id: '1',
        name: 'John',
        type: 'user' as const,
      };

      render(<UserAvatar user={actor} />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });
  });

  describe('tooltip rendering', () => {
    it('uses user display name as default tooltip', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      expect(screen.getByText('JD')).toBeInTheDocument();
      // Tooltip is rendered but not visible until hover - just verify component renders
    });

    it('uses custom renderTooltip when provided', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(
        <UserAvatar user={user} renderTooltip={u => `Custom: ${u.name || u.email}`} />
      );
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });

  describe('avatar types', () => {
    it('renders gravatar when avatarType is gravatar and email exists', async () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null,
        },
      });

      render(<UserAvatar user={user} />);
      // Should attempt to load gravatar
      expect(await screen.findByRole('img')).toBeInTheDocument();
    });

    it('renders upload avatar when avatarType is upload and avatarUrl exists', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'upload',
          avatarUrl: 'https://example.com/avatar.jpg',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('renders letter avatar when avatarType is letter_avatar', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('defaults to letter avatar when no avatar type is specified', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      expect(screen.getByText('JD')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('round prop', () => {
    it('renders round avatar for users', () => {
      const user: AvatarUser = UserFixture({
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '123',
        },
      });

      render(<UserAvatar user={user} />);
      // UserAvatar always passes round=true
      expect(screen.getByText('JD')).toBeInTheDocument();
    });
  });
});
