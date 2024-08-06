from sentry.integrations.jira.tasks import sync_metadata as sync_metadata_new
from sentry.integrations.models.integration import Integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.jira.sync_metadata",
    queue="integrations.control",
    default_retry_delay=20,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(on=(IntegrationError,), exclude=(Integration.DoesNotExist,))
def sync_metadata(integration_id: int) -> None:
    sync_metadata_new(integration_id=integration_id)
