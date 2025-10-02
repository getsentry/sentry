import logging

from sentry.integrations.jsm.metrics import record_event
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.services.integration.service import integration_service
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry

ALERT_LEGACY_INTEGRATIONS = {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
ALERT_LEGACY_INTEGRATIONS_WITH_NAME = {
    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
    "name": "Send a notification (for all legacy integrations)",
}
logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.jsm.tasks.migrate_jsm_plugins",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        retry=Retry(
            times=5,
            delay=60 * 5,
        ),
    ),
)
@retry(exclude=(Integration.DoesNotExist, OrganizationIntegration.DoesNotExist))
def migrate_jsm_plugin(integration_id: int, organization_id: int) -> None:
    with record_event(OnCallInteractionType.MIGRATE_PLUGIN).capture():
        result = integration_service.organization_context(
            organization_id=organization_id, integration_id=integration_id
        )
        integration = result.integration
        organization_integration = result.organization_integration
        if not integration:
            raise Integration.DoesNotExist
        if not organization_integration:
            raise OrganizationIntegration.DoesNotExist

        config = organization_integration.config
        team_table = config["team_table"]

        seen_keys = {}
        for i in range(len(config["team_table"])):
            seen_keys[team_table[i]["integration_key"]] = i

        logger.info(
            "api_keys.migrated",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
            },
        )
