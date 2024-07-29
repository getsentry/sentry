from sentry.integrations.github.tasks.link_all_repos import link_all_repos as new_link_all_repos
from sentry.plugins.providers.integration_repository import RepoExistsError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


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
    new_link_all_repos(integration_key, integration_id, organization_id)
