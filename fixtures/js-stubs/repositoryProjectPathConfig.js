export function RepositoryProjectPathConfig(project, repo, integration, params) {
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
    ...params,
  };
}
