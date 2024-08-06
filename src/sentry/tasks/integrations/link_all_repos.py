from sentry.integrations.github.tasks import link_all_repos as link_all_repos_new
from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


def get_repo_config(repo, integration_id):
    return {
        "external_id": repo["id"],
        "integration_id": integration_id,
        "identifier": repo["full_name"],
    }


@instrumented_task(
    name="sentry.integrations.github.link_all_repos",
    queue="integrations.control",
    max_retries=3,
    silo_mode=SiloMode.CONTROL,
)
@retry(
    exclude=(
        RepoExistsError,
        KeyError,
    )
)
def link_all_repos(
    integration_key: str,
    integration_id: int,
    organization_id: int,
):
    link_all_repos_new(
        integration_key=integration_key,
        integration_id=integration_id,
        organization_id=organization_id,
    )
