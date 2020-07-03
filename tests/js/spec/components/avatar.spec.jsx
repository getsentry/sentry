import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Avatar from 'app/components/avatar';

jest.mock('app/stores/configStore', () => ({
  getConfig: () => ({
    gravatarBaseUrl: 'gravatarBaseUrl',
  }),
}));

describe('Avatar', function() {
  const USER = {
    id: '1',
    name: 'Jane Bloggs',
    email: 'janebloggs@example.com',
  };

  describe('render()', function() {
    it('has `avatar` className', function() {
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      const avatar = mountWithTheme(<Avatar user={user} />);
      expect(avatar.find('span.avatar')).toHaveLength(1);
    });

    it('should show a gravatar when avatar type is gravatar', async function() {
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      const avatar = mountWithTheme(<Avatar user={user} />);

      expect(avatar.find('BaseAvatar').prop('type')).toBe('gravatar');

      // Need update because Gravatar async imports a library
      await tick();
      avatar.update();

      expect(avatar.find('BaseAvatar Gravatar Image').prop('src')).toMatch(
        'gravatarBaseUrl/avatar/'
      );
    });

    it('should show an upload when avatar type is upload', function() {
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      const avatar = mountWithTheme(<Avatar user={user} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('upload');
      expect(avatar.find('BaseAvatar').prop('uploadId')).toBe(
        '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
      );
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e'
      );
    });

    it('should show an upload with the correct size (static 120 size)', function() {
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mountWithTheme(<Avatar user={user} size={76} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=120'
      );

      avatar = mountWithTheme(<Avatar user={user} size={121} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=120'
      );

      avatar = mountWithTheme(<Avatar user={user} size={32} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=120'
      );

      avatar = mountWithTheme(<Avatar user={user} size={1} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=120'
      );
    });

    it('should not show upload or gravatar when avatar type is letter', function() {
      const user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      const avatar = mountWithTheme(<Avatar user={user} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('letter_avatar');
    });

    it('use letter avatar by default, when no avatar type is set and user has an email address', function() {
      const avatar = mountWithTheme(<Avatar user={USER} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('letter_avatar');
    });

    it('should show a gravatar when no avatar type is set and user has an email address', function() {
      const avatar = mountWithTheme(<Avatar gravatar user={USER} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('gravatar');
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function() {
      const user = Object.assign({}, USER);
      delete user.email;
      const avatar = mountWithTheme(<Avatar gravatar user={user} />);

      expect(avatar.find('BaseAvatar').prop('type')).toBe('letter_avatar');
    });

    it('can display a team Avatar', function() {
      const team = TestStubs.Team({slug: 'test-team_test'});
      const avatar = mountWithTheme(<Avatar team={team} />);
      expect(avatar.find('LetterAvatar').prop('displayName')).toBe('test team test');
      expect(avatar.find('LetterAvatar').prop('identifier')).toBe('test-team_test');
    });

    it('can display an organization Avatar', function() {
      const organization = TestStubs.Organization({slug: 'test-organization'});
      const avatar = mountWithTheme(<Avatar organization={organization} />);
      expect(avatar.find('LetterAvatar').prop('displayName')).toBe('test organization');
      expect(avatar.find('LetterAvatar').prop('identifier')).toBe('test-organization');
    });

    it('displays platform list icons for project Avatar', function() {
      const project = TestStubs.Project({
        platforms: ['python', 'javascript'],
        platform: 'java',
      });
      const avatar = mountWithTheme(<Avatar project={project} />);
      expect(avatar.find('PlatformList').prop('platforms')).toEqual(['java']);
    });

    it('displays a fallback platform list for project Avatar using the `platform` specified during onboarding', function() {
      const project = TestStubs.Project({platform: 'java'});
      const avatar = mountWithTheme(<Avatar project={project} />);
      expect(avatar.find('PlatformList').prop('platforms')).toEqual(['java']);
    });
    it('uses onboarding project when platforms is an empty array', function() {
      const project = TestStubs.Project({platforms: [], platform: 'java'});
      const avatar = mountWithTheme(<Avatar project={project} />);
      expect(avatar.find('PlatformList').prop('platforms')).toEqual(['java']);
    });
  });
});
