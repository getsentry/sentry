from sentry.models.integrations.integration import Integration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo import SiloMode
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
    integration = Integration.objects.get(id=integration_id)
    org_install = integration.organizationintegration_set.first()
    if not org_install:
        return
    installation = integration.get_installation(org_install.organization_id)
    installation.sync_metadata()
