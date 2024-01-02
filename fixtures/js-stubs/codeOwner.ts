import {GitHubIntegration} from 'sentry-fixture/githubIntegration';
import {Project} from 'sentry-fixture/project';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';

import type {
  CodeOwner as TCodeOwner,
  OrganizationIntegration,
  Project as TProject,
  Repository as TRepository,
} from 'sentry/types';

interface CodeOwnerParams extends Partial<TCodeOwner> {
  integration?: OrganizationIntegration;
  project?: TProject;
  repo?: TRepository;
}

export function CodeOwner({
  project = Project(),
  repo = Repository(),
  ...params
}: CodeOwnerParams = {}): TCodeOwner {
  const integration = GitHubIntegration();

  return {
    id: '1225',
    raw: '',
    dateCreated: '2022-11-18T15:05:47.450354Z',
    dateUpdated: '2023-02-24T18:43:08.729490Z',
    codeMappingId: '11',
    provider: 'github',
    codeMapping: RepositoryProjectPathConfig({project, repo, integration}),
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
