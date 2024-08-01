from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations.link_all_repos import link_all_repos as link_all_repos_old


@instrumented_task(
    name="sentry.integrations.github.tasks.link_all_repos",
    queue="integrations.control",
    max_retries=3,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(RepoExistsError, KeyError))
def link_all_repos(
    integration_key: str,
    integration_id: int,
    organization_id: int,
):
    link_all_repos_old(
        integration_key=integration_key,
        integration_id=integration_id,
        organization_id=organization_id,
    )
