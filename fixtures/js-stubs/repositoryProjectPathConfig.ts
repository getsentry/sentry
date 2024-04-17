import type {
  Integration,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

interface RepositoryProjectPathConfigArgs extends Partial<RepositoryProjectPathConfig> {
  integration: Pick<Integration, 'id' | 'provider'>;
  project: Pick<Project, 'id' | 'slug'>;
  repo: Pick<Repository, 'id' | 'name'>;
}

export function RepositoryProjectPathConfigFixture(
  params: RepositoryProjectPathConfigArgs
): RepositoryProjectPathConfig {
  const {project, repo, integration, ...rest} = params;
  return {
    id: '2',
    projectId: project.id,
    projectSlug: project.slug,
    repoId: repo.id,
    repoName: repo.name,
    integrationId: integration.id,
    provider: integration.provider,
    stackRoot: '',
    sourceRoot: '',
    defaultBranch: 'master',
    ...rest,
  };
}
