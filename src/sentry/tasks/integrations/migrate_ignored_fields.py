from sentry.models import OrganizationIntegration
from sentry.tasks.base import instrumented_task
from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.migrate_ignored_fields",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
def migrate_ignored_fields(
    integration_id: int,
    organization_id: int,
    project_id: int,
    plugin_slug: str,
    plugin_ignored_fields: list,
) -> None:
    organization_integration = OrganizationIntegration.objects.get(integration_id=integration_id)
    config = organization_integration.config
    integration_ignored_fields = organization_integration.config.get("issues_ignored_fields")
    formatted_plugin_ignored_fields = {x.strip() for x in plugin_ignored_fields.split(",")}
    combo = {
        "issues_ignored_fields": list(
            formatted_plugin_ignored_fields | set(integration_ignored_fields)
        )
    }
    config.update(combo)
    organization_integration.update(config=config)
    logger.info(
        "plugin_ignored_fields.migrated",
        extra={
            "integration_id": integration_id,
            "organization_id": organization_id,
            "project_id": project_id,
            "plugin": plugin_slug,
        },
    )
