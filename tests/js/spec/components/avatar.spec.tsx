import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import AvatarComponent from 'app/components/avatar';
import {Avatar} from 'app/types';

const gravatarBaseUrl = 'gravatarBaseUrl';

jest.mock('app/stores/configStore', () => ({
  getConfig: () => ({gravatarBaseUrl}),
}));

describe('Avatar', function () {
  const avatar: Avatar = {
    avatarType: 'gravatar',
    avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
  };

  const user = {
    id: '1',
    name: 'Jane Bloggs',
    username: 'janebloggs@example.com',
    email: 'janebloggs@example.com',
    ip_address: '127.0.0.1',
    avatar,
  };

  const userNameInitials = user.name
    .split(' ')
    .map(n => n[0])
    .join('');

  describe('render()', function () {
    it('has `avatar` className', function () {
      const {getByTestId} = mountWithTheme(<AvatarComponent user={user} />);

      const avatarElement = getByTestId(`${avatar.avatarType}-avatar`);
      expect(avatarElement).toBeInTheDocument();
      expect(avatarElement).toHaveAttribute('title', user.name);
    });

    it('should show a gravatar when avatar type is gravatar', async function () {
      const {getByTestId, findByRole} = mountWithTheme(<AvatarComponent user={user} />);

      expect(getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      const avatarImage = await findByRole('img');
      expect(avatarImage).toHaveAttribute(
        'src',
        `${gravatarBaseUrl}/avatar/a94c88e18c44e553497bf642449b6398?d=404&s=120`
      );
    });

    it('should show an upload when avatar type is upload', async function () {
      avatar.avatarType = 'upload';

      const {getByTestId, findByRole} = mountWithTheme(<AvatarComponent user={user} />);

      expect(getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      const avatarImage = await findByRole('img');
      expect(avatarImage).toHaveAttribute('src', `/avatar/${avatar.avatarUuid}/?s=120`);
    });

    it('should show an upload with the correct size (static 120 size)', async function () {
      const avatar1 = mountWithTheme(<AvatarComponent user={user} size={76} />);
      expect(await avatar1.findByRole('img')).toHaveAttribute(
        'src',
        `/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar1.unmount();

      const avatar2 = mountWithTheme(<AvatarComponent user={user} size={121} />);
      expect(await avatar2.findByRole('img')).toHaveAttribute(
        'src',
        `/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar2.unmount();

      const avatar3 = mountWithTheme(<AvatarComponent user={user} size={32} />);
      expect(await avatar3.findByRole('img')).toHaveAttribute(
        'src',
        `/avatar/${avatar.avatarUuid}/?s=120`
      );

      avatar3.unmount();

      const avatar4 = mountWithTheme(<AvatarComponent user={user} size={1} />);
      expect(await avatar4.findByRole('img')).toHaveAttribute(
        'src',
        `/avatar/${avatar.avatarUuid}/?s=120`
      );
    });

    it('should not show upload or gravatar when avatar type is letter', function () {
      avatar.avatarType = 'letter_avatar';

      const {getByTestId, getByText} = mountWithTheme(<AvatarComponent user={user} />);

      expect(getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      expect(getByText(userNameInitials)).toBeInTheDocument();
    });

    it('use letter avatar by default, when no avatar type is set and user has an email address', function () {
      const {getByTestId, getByText} = mountWithTheme(
        <AvatarComponent user={{...user, avatar: undefined}} />
      );

      expect(getByTestId(`${avatar.avatarType}-avatar`)).toBeInTheDocument();
      expect(getByText(userNameInitials)).toBeInTheDocument();
    });

    it('should show a gravatar when no avatar type is set and user has an email address', function () {
      const {getByTestId} = mountWithTheme(
        <AvatarComponent gravatar user={{...user, avatar: undefined}} />
      );

      const avatarElement = getByTestId(`gravatar-avatar`);
      expect(avatarElement).toBeInTheDocument();
      expect(avatarElement).toHaveAttribute('title', user.name);
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function () {
      const {getByTestId, getByText} = mountWithTheme(
        <AvatarComponent gravatar user={{...user, email: '', avatar: undefined}} />
      );

      expect(getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(getByText(userNameInitials)).toBeInTheDocument();
    });

    it('can display a team Avatar', function () {
      // @ts-expect-error
      const team = TestStubs.Team({slug: 'test-team_test'});

      const {getByText, getByTestId} = mountWithTheme(<AvatarComponent team={team} />);

      expect(getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(getByText('TT')).toBeInTheDocument();
    });

    it('can display an organization Avatar', function () {
      // @ts-expect-error
      const organization = TestStubs.Organization({slug: 'test-organization'});

      const {getByTestId, getByText} = mountWithTheme(
        <AvatarComponent organization={organization} />
      );

      expect(getByTestId(`letter_avatar-avatar`)).toBeInTheDocument();
      expect(getByText('TO')).toBeInTheDocument();
    });

    it('displays platform list icons for project Avatar', function () {
      // @ts-expect-error
      const project = TestStubs.Project({
        platforms: ['python', 'javascript'],
        platform: 'java',
      });

      const {getByRole} = mountWithTheme(<AvatarComponent project={project} />);

      const platformIcon = getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });

    it('displays a fallback platform list for project Avatar using the `platform` specified during onboarding', function () {
      // @ts-expect-error
      const project = TestStubs.Project({platform: 'java'});

      const {getByRole} = mountWithTheme(<AvatarComponent project={project} />);

      const platformIcon = getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });

    it('uses onboarding project when platforms is an empty array', function () {
      // @ts-expect-error
      const project = TestStubs.Project({platforms: [], platform: 'java'});

      const {getByRole} = mountWithTheme(<AvatarComponent project={project} />);

      const platformIcon = getByRole('img');
      expect(platformIcon).toBeInTheDocument();
      expect(platformIcon).toHaveAttribute(
        'data-test-id',
        `platform-icon-${project.platform}`
      );
    });
  });
});
