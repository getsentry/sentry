import React from 'react';
import {shallow} from 'enzyme';
import Avatar from 'app/components/avatar';

describe('Avatar', function() {
  const USER = {
    id: 1,
    name: 'Jane Doe',
    email: 'janedoe@example.com'
  };

  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('render()', function() {
    it('should show a gravatar when avatar type is gravatar', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
        }
      });
      let avatar = shallow(<Avatar user={user}/>).instance();
      this.sandbox.stub(avatar, 'buildGravatarUrl');
      this.sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.calledOnce).to.be.ok;
      expect(avatar.buildProfileUrl.called).to.not.be.ok;
    });

    it('should show an upload when avatar type is upload', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'upload',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
        }
      });
      let avatar = shallow(<Avatar user={user}/>).instance();
      this.sandbox.stub(avatar, 'buildGravatarUrl');
      this.sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildProfileUrl.calledOnce).to.be.ok;
      expect(avatar.buildGravatarUrl.called).to.not.be.ok;
    });

    it('should not show upload or gravatar when avatar type is letter', function() {
      let user = Object.assign({}, USER, {
        avatar: {
          avatarType: 'letter_avatar',
          avatarUuid: '2d641b5d-8c74-44de-9cb6-fbd54701b35e'
        }
      });
      let avatar = shallow(<Avatar user={user}/>).instance();
      this.sandbox.stub(avatar, 'buildGravatarUrl');
      this.sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildProfileUrl.called).to.not.be.ok;
      expect(avatar.buildGravatarUrl.called).to.not.be.ok;
    });

    it('should show a gravatar when no avatar type is set and user has an email address', function() {
      let avatar = shallow(<Avatar user={USER}/>).instance();
      this.sandbox.stub(avatar, 'buildGravatarUrl');
      this.sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.calledOnce).to.be.ok;
      expect(avatar.buildProfileUrl.called).to.not.be.ok;
    });

    it('should not show a gravatar when no avatar type is set and user has no email address', function() {
      let user = Object.assign({}, USER);
      delete user.email;
      let avatar = shallow(<Avatar user={user}/>).instance();
      this.sandbox.stub(avatar, 'buildGravatarUrl');
      this.sandbox.stub(avatar, 'buildProfileUrl');
      avatar.renderImg();
      expect(avatar.buildGravatarUrl.called).to.not.be.ok;
      expect(avatar.buildProfileUrl.called).to.not.be.ok;
    });
  });
});
