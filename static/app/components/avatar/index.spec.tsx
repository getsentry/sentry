import {ActorFixture} from 'sentry-fixture/actor';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AvatarComponent from 'sentry/components/avatar';
import ConfigStore from 'sentry/stores/configStore';
import MemberListStore from 'sentry/stores/memberListStore';
import type {Avatar} from 'sentry/types/core';

describe('Avatar', function () {
  const avatar: Avatar = {
    avatarType: 'gravatar',
    avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
    avatarUrl: 'https://sentry.io/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/',
  };

  const user = UserFixture({
    id: '1',
    name: 'Jane Bloggs',
    username: 'janebloggs@example.com',
    email: 'janebloggs@example.com',
    ip_address: '127.0.0.1',
    avatar,
  });

  window.__initialData = {
    links: {sentryUrl: 'https://sentry.io'},
  } as any;

  const userNameInitials = user.name
    .split(' ')
    .map(n => n[0])
    .join('');

  describe('render()', function () {
    it('has `avatar` className', async function () {
      render(<AvatarComponent user={user} />);
      await screen.findByRole('img');

      const avatarElement = screen.getByTestId(`${avatar.avatarType}-avatar`);
      expect(avatarElement).toBeInTheDocument();
      expect(avatarElement).toHaveAttribute('title', user.name);
    });

    it('should show a gravatar when avatar type is gravatar', async function () {
      const gravatarBaseUrl = 'gravatarBaseUrl';
      ConfigStore.set('gravatarBaseUrl', gravatarBaseUrl);

      render(<AvatarComponent user={user} />);

      expect(screen.getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      const avatarImage = await screen.findByRole('img');
      expect(avatarImage).toHaveAttribute(
        'src',
        `${gravatarBaseUrl}/avatar/4af0e27cabbfd1860ab7985e5becc4dedeaf5e00deec23a2d92d5f8bb1191ccb?d=404&s=120`
      );
    });

    it('should show an upload when avatar type is upload', async function () {
      avatar.avatarType = 'upload';

      render(<AvatarComponent user={user} />);

      expect(screen.getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      const avatarImage = await screen.findByRole('img');
      expect(avatarImage).toHaveAttribute(
        'src',
        `https://sentry.io/avatar/${avatar.avatarUuid}/?s=120`
      );
    });

    it('should show an upload with the correct size (static 120 size)', async function () {
      const avatar1 = render(<AvatarComponent user={user} size={76} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar1.unmount();

      const avatar2 = render(<AvatarComponent user={user} size={121} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar2.unmount();

      const avatar3 = render(<AvatarComponent user={user} size={32} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar3.unmount();

      render(<AvatarComponent user={user} size={1} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/avatar/${avatar.avatarUuid}/?s=120`
      );
    });

    it('should not show upload or gravatar when avatar type is letter', function () {
      avatar.avatarType = 'letter_avatar';

      render(<AvatarComponent user={user} />);

      expect(screen.getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      expect(screen.getByText(userNameInitials)).toBeInTheDocument();
    });

    it('use letter avatar by default, when no avatar type is set and user has an email address', function () {
      render(<AvatarComponent user={{...user, avatar: undefined}} />);

      expect(screen.getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      expect(screen.getByText(userNameInitials)).toBeInTheDocument();
    });

    it('should show a gravatar when no avatar type is set and user has an email address', async function () {
      render(
        <AvatarComponent
          gravatar
          user={{...user, options: undefined, avatar: undefined}}
        />
      );
      await screen.findByRole('img');

      const avatarElement = screen.getByTestId(`gravatar-avatar`);
      expect(avatarElement).toBeInTheDocument();
      expect(avatarElement).toHaveAttribute('title', user.name);
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function () {
      render(<AvatarComponent gravatar user={{...user, email: '', avatar: undefined}} />);

      expect(screen.getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(screen.getByText(userNameInitials)).toBeInTheDocument();
    });

    it('can display a team Avatar', function () {
      const team = TeamFixture({slug: 'test-team_test'});

      render(<AvatarComponent team={team} />);

      expect(screen.getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(screen.getByText('TT')).toBeInTheDocument();
    });

    it('can display an organization Avatar', function () {
      const organization = OrganizationFixture({
        slug: 'test-organization',
        avatar: {avatarType: 'letter_avatar', avatarUuid: ''},
      });

      render(<AvatarComponent organization={organization} />);

      expect(screen.getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(screen.getByText('TO')).toBeInTheDocument();
    });

    it('can display an organization Avatar upload', function () {
      const organization = OrganizationFixture({
        slug: 'test-organization',
        avatar: {
          avatarType: 'upload',
          avatarUuid: 'abc123def',
          avatarUrl: 'https://us.sentry.io/organization-avatar/abc123def/',
        },
      });

      render(<AvatarComponent organization={organization} />);

      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'https://us.sentry.io/organization-avatar/abc123def/?s=120'
      );
    });

    it('can display a actor Avatar', async function () {
      const actor = ActorFixture();
      MemberListStore.loadInitialData([user]);

      render(<AvatarComponent actor={actor} />);

      expect(await screen.findByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(screen.getByText('JB')).toBeInTheDocument();
    });

    it('displays platform list icons for project Avatar', function () {
      const project = ProjectFixture({
        platform: 'java',
      });

      render(<AvatarComponent project={project} />);

      const platformIcon = screen.getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });

    it('displays a fallback platform list for project Avatar using the `platform` specified during onboarding', function () {
      const project = ProjectFixture({platform: 'java'});

      render(<AvatarComponent project={project} />);

      const platformIcon = screen.getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });

    it('uses onboarding project when platforms is an empty array', function () {
      const project = ProjectFixture({platform: 'java'});

      render(<AvatarComponent project={project} />);

      const platformIcon = screen.getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });

    it('renders the correct SentryApp depending on its props', async function () {
      const colorAvatar = {
        avatarUuid: 'abc',
        avatarType: 'upload' as const,
        avatarUrl: 'https://sentry.io/sentry-app-avatar/abc/',
        color: true,
      };
      const simpleAvatar = {
        avatarUuid: 'def',
        avatarType: 'upload' as const,
        avatarUrl: 'https://sentry.io/sentry-app-avatar/def/',
        color: false,
      };

      const sentryApp = SentryAppFixture({
        avatars: [colorAvatar, simpleAvatar],
      });

      const avatar1 = render(<AvatarComponent sentryApp={sentryApp} isColor />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/sentry-app-avatar/${colorAvatar.avatarUuid}/?s=120`
      );
      avatar1.unmount();

      const avatar2 = render(<AvatarComponent sentryApp={sentryApp} isColor={false} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/sentry-app-avatar/${simpleAvatar.avatarUuid}/?s=120`
      );
      avatar2.unmount();

      render(<AvatarComponent sentryApp={sentryApp} isDefault />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
    });

    it('renders the correct fallbacks for SentryAppAvatars', async function () {
      const colorAvatar = {
        avatarUuid: 'abc',
        avatarType: 'upload' as const,
        avatarUrl: 'https://sentry.io/sentry-app-avatar/abc/',
        color: true,
      };
      const sentryApp = SentryAppFixture({avatars: []});

      // No existing avatars
      const avatar1 = render(<AvatarComponent sentryApp={sentryApp} isColor />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
      avatar1.unmount();

      // No provided `isColor` attribute
      sentryApp.avatars!.push(colorAvatar);
      const avatar2 = render(<AvatarComponent sentryApp={sentryApp} />);
      expect(await screen.findByRole('img')).toHaveAttribute(
        'src',
        `https://sentry.io/sentry-app-avatar/${colorAvatar.avatarUuid}/?s=120`
      );
      avatar2.unmount();

      // avatarType of `default`
      sentryApp.avatars![0]!.avatarType = 'default';
      render(<AvatarComponent sentryApp={sentryApp} isColor />);
      expect(screen.getByTestId('default-sentry-app-avatar')).toBeInTheDocument();
    });
  });
});
