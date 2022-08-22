from sentry.models import Integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.jira.sync_metadata",
    queue="integrations",
    default_retry_delay=20,
    max_retries=5,
)
@retry(on=(IntegrationError,), exclude=(Integration.DoesNotExist,))
def sync_metadata(integration_id: int) -> None:
    integration = Integration.objects.get(id=integration_id)
    installation = integration.get_installation(None)
    installation.sync_metadata()
