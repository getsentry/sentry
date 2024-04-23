from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.repository import Repository


def get_repos_from_project_code_mappings(project: Project) -> list[dict]:
    repo_configs: list[RepositoryProjectPathConfig] = RepositoryProjectPathConfig.objects.filter(
        project__in=[project]
    )

    repos: dict[tuple, dict] = {}
    for repo_config in repo_configs:
        repo: Repository = repo_config.repository
        repo_name_sections = repo.name.split("/")

        # We expect a repository name to be in the format of "owner/name" for now.
        if len(repo_name_sections) > 1 and repo.provider:
            repo_dict = {
                "provider": repo.provider,
                "owner": repo_name_sections[0],
                "name": "/".join(repo_name_sections[1:]),
                "external_id": repo.external_id,
            }
            repo_key = (repo_dict["provider"], repo_dict["owner"], repo_dict["name"])

            repos[repo_key] = repo_dict

    return list(repos.values())
