import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

describe('valueIsEqual', function () {
  it('should return true when objects are deeply equal', function () {
    const isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null,
        },
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null,
        },
      },
      true
    );
    expect(isEqual).toBe(true);
  });

  it('should return false when objects are not deeply equal', function () {
    const isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null,
        },
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'notGravatar',
          avatarUuid: null,
        },
      },
      true
    );
    expect(isEqual).toBe(false);
  });

  it('should return true when objects are shallowly equal', function () {
    const isEqual = valueIsEqual(
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar',
      },
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar',
      },
      false
    );
    expect(isEqual).toBe(true);
  });

  it('should return false when objects are not shallowly equal', function () {
    const isEqual = valueIsEqual(
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar',
      },
      {
        username: 'foo',
        team: 'bar',
        avatar: 'notGravatar',
      },
      false
    );
    expect(isEqual).toBe(false);
  });

  it('should not blow up when comparing null value to an object', function () {
    let isEqual = valueIsEqual(null, {username: 'foo'}, true);
    expect(isEqual).toBe(false);

    isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: null,
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'notGravatar',
          avatarUuid: null,
        },
      },
      true
    );
    expect(isEqual).toBe(false);
  });
});
