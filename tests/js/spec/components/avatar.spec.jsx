import React from 'react';
import {shallow} from 'enzyme';
import Avatar from 'app/components/avatar';

describe('Avatar', function() {
  let sandbox;

  const USER = {
    id: 1,
    name: 'Jane Doe',
    email: 'janedoe@example.com',
  };

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('has `avatar` className', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = shallow(<Avatar user={user} />);
      expect(avatar.find('.avatar')).toHaveLength(1);
    });

    it('should show a gravatar when avatar type is gravatar', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = shallow(<Avatar user={user} />).instance();
      sandbox.stub(avatar, 'buildGravatarUrl');
      sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.calledOnce).toBeTruthy();
      expect(avatar.buildProfileUrl.called).not.toBeTruthy();
    });

    it('should show an upload when avatar type is upload', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = shallow(<Avatar user={user} />).instance();
      sandbox.stub(avatar, 'buildGravatarUrl');
      sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildProfileUrl.calledOnce).toBeTruthy();
      expect(avatar.buildGravatarUrl.called).not.toBeTruthy();
    });

    it('should not show upload or gravatar when avatar type is letter', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e',
        },
      });
      let avatar = shallow(<Avatar user={user} />).instance();
      sandbox.stub(avatar, 'buildGravatarUrl');
      sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildProfileUrl.called).not.toBeTruthy();
      expect(avatar.buildGravatarUrl.called).not.toBeTruthy();
    });

    it('should show a gravatar when no avatar type is set and user has an email address', function() {
      let avatar = shallow(<Avatar user={USER} />).instance();
      sandbox.stub(avatar, 'buildGravatarUrl');
      sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.calledOnce).toBeTruthy();
      expect(avatar.buildProfileUrl.called).not.toBeTruthy();
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function() {
      let user = Object.assign({}, USER);
      delete user.email;
      let avatar = shallow(<Avatar user={user} />).instance();
      sandbox.stub(avatar, 'buildGravatarUrl');
      sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.called).not.toBeTruthy();
      expect(avatar.buildProfileUrl.called).not.toBeTruthy();
    });
  });
});
