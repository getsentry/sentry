import React from 'react';
import {mount} from 'enzyme';
import Avatar from 'app/components/avatar';

jest.mock('app/stores/configStore', () => {
  return {
    getConfig: () => ({
      gravatarBaseUrl: 'gravatarBaseUrl',
    }),
  };
});

describe('Avatar', function() {
  const USER = {
    id: '1',
    name: 'Jane Doe',
    email: 'janedoe@example.com',
  };

  describe('render()', function() {
    it('has `avatar` className', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mount(<Avatar user={user} />);
      expect(avatar.find('span.avatar')).toHaveLength(1);
    });

    it('should show a gravatar when avatar type is gravatar', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mount(<Avatar user={user} />);

      expect(avatar.find('BaseAvatar').prop('type')).toBe('gravatar');
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        'gravatarBaseUrl/avatar/'
      );
    });

    it('should show an upload when avatar type is upload', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mount(<Avatar user={user} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('upload');
      expect(avatar.find('BaseAvatar').prop('uploadId')).toBe(
        '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
      );
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e'
      );
    });

    it('should show an upload with the correct size', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mount(<Avatar user={user} size={76} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=80'
      );

      avatar = mount(<Avatar user={user} size={121} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=120'
      );

      avatar = mount(<Avatar user={user} size={32} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=32'
      );

      avatar = mount(<Avatar user={user} size={1} />);
      expect(avatar.find('BaseAvatar img').prop('src')).toMatch(
        '/avatar/2d641b5d-8c74-44de-9cb6-fbd54701b35e/?s=20'
      );
    });

    it('should not show upload or gravatar when avatar type is letter', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = mount(<Avatar user={user} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('letter_avatar');
    });

    it('should show a gravatar when no avatar type is set and user has an email address', function() {
      let avatar = mount(<Avatar user={USER} />);
      expect(avatar.find('BaseAvatar').prop('type')).toBe('gravatar');
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function() {
      let user = Object.assign({}, USER);
      delete user.email;
      let avatar = mount(<Avatar user={user} />);

      expect(avatar.find('BaseAvatar').prop('type')).toBe('letter_avatar');
    });

    it('can display a team Avatar', function() {
      let team = TestStubs.Team({slug: 'test-team_test'});
      let avatar = mount(<Avatar team={team} />);
      expect(avatar.find('LetterAvatar').prop('displayName')).toBe('test team test');
      expect(avatar.find('LetterAvatar').prop('identifier')).toBe('test-team_test');
    });

    it('can display an organization Avatar', function() {
      let organization = TestStubs.Organization({slug: 'test-organization'});
      let avatar = mount(<Avatar organization={organization} />);
      expect(avatar.find('LetterAvatar').prop('displayName')).toBe('test organization');
      expect(avatar.find('LetterAvatar').prop('identifier')).toBe('test-organization');
    });
  });
});
