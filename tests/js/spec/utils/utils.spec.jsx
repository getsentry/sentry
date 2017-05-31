import {valueIsEqual, extractMultilineFields, parseGitHubRepo} from 'app/utils';

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

describe('utils.parseGitHubRepo', function() {
  it('should work for simple github url', function() {
    expect(parseGitHubRepo('github.com/example/example')).toEqual('example/example');
  });
  it('should work for full github url', function() {
    expect(parseGitHubRepo('https://github.com/example/example')).toEqual(
      'example/example'
    );
  });
  it('should work for trailing slash', function() {
    expect(parseGitHubRepo('https://github.com/example/example/')).toEqual(
      'example/example'
    );
  });
  it('should work for repo only', function() {
    expect(parseGitHubRepo('example/example')).toEqual('example/example');
  });
  it('should parse repo from url with extra info', function() {
    expect(parseGitHubRepo('github.com/example/example/commits/adsadsa')).toEqual(
      'example/example'
    );
  });
});
