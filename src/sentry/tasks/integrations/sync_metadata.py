from sentry.integrations.models.integration import Integration
from sentry.integrations.tasks.sync_metadata import sync_metadata as new_sync_metadata
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
    new_sync_metadata(integration_id)
