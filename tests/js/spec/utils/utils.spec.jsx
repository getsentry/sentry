import {valueIsEqual} from 'app/utils';

describe('utils.valueIsEqual', function() {

  it('should return true when objects are deeply equal', function() {
    let isEqual = valueIsEqual({
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: {
        avatarType: 'gravatar',
        avatarUuid: null
      }
    }, {
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: {
        avatarType: 'gravatar',
        avatarUuid: null
      }
    }, true);
    expect(isEqual).to.be.true;
  });

  it('should return false when objects are not deeply equal', function() {
    let isEqual = valueIsEqual({
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: {
        avatarType: 'gravatar',
        avatarUuid: null
      }
  }, {
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: {
        avatarType: 'notGravatar',
        avatarUuid: null
      }
    }, true);
    expect(isEqual).to.be.false;
  });

  it('should return true when objects are shalowly equal', function() {
    let isEqual = valueIsEqual({
      username: 'foo',
      team: 'bar',
      avatar: 'gravatar'
    }, {
      username: 'foo',
      team: 'bar',
      avatar: 'gravatar'
    }, false);
    expect(isEqual).to.be.true;
  });

  it('should return false when objects are not shalowly equal', function() {
    let isEqual = valueIsEqual({
      username: 'foo',
      team: 'bar',
      avatar: 'gravatar'
    }, {
      username: 'foo',
      team: 'bar',
      avatar: 'notGravatar'
    }, false);
    expect(isEqual).to.be.false;
  });

  it('should not blow up when comparing null value to an object', function() {
    let isEqual = valueIsEqual(null, {username: 'foo'}, true);
    expect(isEqual).to.be.false;

    isEqual = valueIsEqual({
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: null
    }, {
      username: 'foo',
      teams: ['bar', 'baz'],
      avatar: {
        avatarType: 'notGravatar',
        avatarUuid: null
      }
    }, true);
    expect(isEqual).to.be.false;
  });
});
