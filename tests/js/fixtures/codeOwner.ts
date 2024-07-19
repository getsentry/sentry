import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import type {
  CodeOwner,
  OrganizationIntegration,
  Repository,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

interface CodeOwnerParams extends Partial<CodeOwner> {
  integration?: OrganizationIntegration;
  project?: Project;
  repo?: Repository;
}

export function CodeOwnerFixture({
  project = ProjectFixture(),
  repo = RepositoryFixture(),
  ...params
}: CodeOwnerParams = {}): CodeOwner {
  const integration = GitHubIntegrationFixture();

  return {
    id: '1225',
    raw: '',
    dateCreated: '2022-11-18T15:05:47.450354Z',
    dateUpdated: '2023-02-24T18:43:08.729490Z',
    codeMappingId: '11',
    provider: 'github',
    codeMapping: RepositoryProjectPathConfigFixture({project, repo, integration}),
    codeOwnersUrl: 'https://github.com/getsentry/sentry/blob/master/.github/CODEOWNERS',
    ownershipSyntax: '',
    errors: {
      missing_user_emails: [],
      missing_external_users: [],
      missing_external_teams: [],
      teams_without_access: [],
      users_without_access: [],
    },
    ...params,
  };
}
