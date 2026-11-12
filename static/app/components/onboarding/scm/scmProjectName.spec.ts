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

  describe('provider-specific name formats', () => {
    it('handles GitLab name_with_namespace (spaces around /)', () => {
      // GitLab stores "name_with_namespace" which uses " / " as the separator.
      // Without trimming, " Example Repo" would slugify to "-example-repo".
      const repository = RepositoryFixture({name: 'Parent / Subgroup / Example Repo'});
      expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe(
        'example-repo'
      );
    });

    it('handles Bitbucket Server PROJECT_KEY/slug format', () => {
      const repository = RepositoryFixture({name: 'PROJ/helloworld'});
      expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe(
        'helloworld'
      );
    });

    it('handles Azure DevOps bare repo name (no slash)', () => {
      // Azure DevOps stores just the repo name; the project is in config.project.
      const repository = RepositoryFixture({name: 'MyRepo'});
      expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe(
        'myrepo'
      );
    });

    it('handles Perforce //depot path', () => {
      // Perforce names start with "//"; empty segments from the leading "//" are filtered.
      const repository = RepositoryFixture({name: '//depot'});
      expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe('depot');
    });

    it('handles Perforce //depot/project path with trailing slash', () => {
      // A manually-added Perforce path may include a trailing slash.
      const repository = RepositoryFixture({name: '//depot/project/'});
      expect(getScmDefaultProjectName({repository, platformKey: 'python'})).toBe(
        'project'
      );
    });
  });
});
