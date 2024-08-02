from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.opsgenie.tasks import (
    migrate_opsgenie_plugin as migrate_opsgenie_plugin_new,
)
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.migrate_opsgenie_plugins",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist, OrganizationIntegration.DoesNotExist))
def migrate_opsgenie_plugin(integration_id: int, organization_id: int) -> None:
    migrate_opsgenie_plugin_new(integration_id=integration_id, organization_id=organization_id)
