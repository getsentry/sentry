import {valueIsEqual, extractMultilineFields} from 'app/utils';

describe('utils.valueIsEqual', function() {
  it('should return true when objects are deeply equal', function() {
    let isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null
        }
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null
        }
      },
      true
    );
    expect(isEqual).toBe(true);
  });

  it('should return false when objects are not deeply equal', function() {
    let isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'gravatar',
          avatarUuid: null
        }
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'notGravatar',
          avatarUuid: null
        }
      },
      true
    );
    expect(isEqual).toBe(false);
  });

  it('should return true when objects are shalowly equal', function() {
    let isEqual = valueIsEqual(
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar'
      },
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar'
      },
      false
    );
    expect(isEqual).toBe(true);
  });

  it('should return false when objects are not shalowly equal', function() {
    let isEqual = valueIsEqual(
      {
        username: 'foo',
        team: 'bar',
        avatar: 'gravatar'
      },
      {
        username: 'foo',
        team: 'bar',
        avatar: 'notGravatar'
      },
      false
    );
    expect(isEqual).toBe(false);
  });

  it('should not blow up when comparing null value to an object', function() {
    let isEqual = valueIsEqual(null, {username: 'foo'}, true);
    expect(isEqual).toBe(false);

    isEqual = valueIsEqual(
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: null
      },
      {
        username: 'foo',
        teams: ['bar', 'baz'],
        avatar: {
          avatarType: 'notGravatar',
          avatarUuid: null
        }
      },
      true
    );
    expect(isEqual).toBe(false);
  });
});

describe('utils.extractMultilineFields', function() {
  it('should work for basic, simple values', function() {
    expect(extractMultilineFields('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });

  it('should return an empty array if only whitespace', function() {
    expect(extractMultilineFields('    \n    \n\n\n   \n')).toEqual([]);
  });

  it('should trim values and ignore empty lines', function() {
    expect(
      extractMultilineFields(
        `one
  two

three
        four

five`
      )
    ).toEqual(['one', 'two', 'three', 'four', 'five']);
  });
});
