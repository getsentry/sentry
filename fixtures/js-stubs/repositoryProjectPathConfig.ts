import type {
  Integration,
  Project,
  Repository,
  RepositoryProjectPathConfig as RepositoryProjectPathConfigType,
} from 'sentry/types';

interface RepositoryProjectPathConfigArgs
  extends Partial<RepositoryProjectPathConfigType> {
  integration: Pick<Integration, 'id' | 'provider'>;
  project: Pick<Project, 'id' | 'slug'>;
  repo: Pick<Repository, 'id' | 'name'>;
}

export function RepositoryProjectPathConfig(
  params: RepositoryProjectPathConfigArgs
): RepositoryProjectPathConfigType {
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
