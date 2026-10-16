import {RepositoryFixture} from 'sentry-fixture/repository';

import {getScmDefaultProjectName} from './scmProjectName';

describe('getScmDefaultProjectName', () => {
  it('returns the last path segment of the repository name', () => {
    const repository = RepositoryFixture({name: 'getsentry/sentry'});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe('sentry');
  });

  it('falls back to the platform key when no repository is provided', () => {
    expect(
      getScmDefaultProjectName({repository: undefined, platformKey: 'javascript-react'})
    ).toBe('javascript-react');
  });

  it('truncates long repository names to 50 characters', () => {
    const repository = RepositoryFixture({name: 'owner/' + 'a'.repeat(60)});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toHaveLength(
      50
    );
  });

  it('falls back to platform key when the repository name slugifies to empty', () => {
    const repository = RepositoryFixture({name: '---'});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe('python');
  });

  it('falls back to the platform key when the repo name is a reserved slug', () => {
    const repository = RepositoryFixture({name: 'acme/settings'});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe('python');
  });

  it('is case-insensitive when checking reserved slugs', () => {
    const repository = RepositoryFixture({name: 'acme/Auth'});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe('python');
  });

  it('does not fall back for a name that merely contains a reserved word', () => {
    const repository = RepositoryFixture({name: 'acme/settings-ui'});
    expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe(
      'settings-ui'
    );
  });
});
