import {GitHubIntegration} from './githubIntegration';
import {Project} from './project';
import {Repository} from './repository';
import {RepositoryProjectPathConfig} from './repositoryProjectPathConfig';

export function CodeOwner({
  project = Project(),
  repo = Repository(),
  integration = GitHubIntegration(),
  ...params
} = {}) {
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
