import logging

from django.db import router, transaction

from sentry.models import Integration, Project, Rule
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration.service import integration_service
from sentry.tasks.base import instrumented_task, retry

ALERT_LEGACY_INTEGRATIONS = {
    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
    "name": "Send a notification (for all legacy integrations)",
}
logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.integrations.migrate_opsgenie_plugin",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=[Integration.DoesNotExist, OrganizationIntegration.DoesNotExist])
def migrate_opsgenie_plugin(integration_id: int, organization_id: int) -> None:
    from sentry_plugins.opsgenie.plugin import OpsGeniePlugin

    integration, organization_integration = integration_service.get_organization_context(
        organization_id=organization_id, integration_id=integration_id
    )
    if not integration:
        raise Integration.DoesNotExist
    if not organization_integration:
        raise OrganizationIntegration.DoesNotExist

    seen_keys = {team["integration_key"] for team in organization_integration.config["team_table"]}

    all_projects = Project.objects.filter(organization_id=organization_id)
    plugin = OpsGeniePlugin()
    opsgenie_projects = [
        p for p in all_projects if plugin.is_enabled(project=p) and plugin.is_configured(project=p)
    ]

    for project in opsgenie_projects:
        # migrate key
        config = organization_integration.config
        team_table = config["team_table"]
        api_key = plugin.get_option("api_key", project)
        if api_key not in seen_keys:
            seen_keys.add(api_key)
            team = {
                "team": f"{project.name} [MIGRATED]",
                "id": f"{str(organization_id)}-{project.name}",
                "integration_key": api_key,
            }
            team_table.append(team)
            config.update({"team_table": team_table})
            oi = integration_service.update_organization_integration(
                org_integration_id=organization_integration.id, config=config
            )
            if not oi:  # the call to update_organization_integration failed
                raise Exception("Failed to update team table.")
            logger.info(
                "api_key.migrated",
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "project_id": project.id,
                    "team_name": team["team"],
                    "plugin": plugin.slug,
                },
            )
        else:
            team = [team for team in team_table if team["integration_key"] == api_key][0]
            logger.info(
                "api_key.key_already_exists",
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "project_id": project.id,
                    "team_name": team["team"],
                    "plugin": plugin.slug,
                },
            )

        # migrate alert rules
        rules_to_migrate = [
            rule
            for rule in Rule.objects.filter(project_id=project.id)
            if ALERT_LEGACY_INTEGRATIONS in rule.data["actions"]
        ]

        with transaction.atomic(router.db_for_write(Rule)):
            for rule in rules_to_migrate:
                actions = rule.data["actions"]
                new_action = {
                    "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                    "account": organization_integration.id,
                    "team": team["id"],
                }
                if new_action not in actions:
                    actions.append(new_action)
                    logger.info(
                        "alert_rule.migrated",
                        extra={
                            "integration_id": integration_id,
                            "organization_id": organization_id,
                            "project_id": project.id,
                            "plugin": plugin.slug,
                        },
                    )
                else:
                    logger.info(
                        "alert_rule.already_exists",
                        extra={
                            "integration_id": integration_id,
                            "organization_id": organization_id,
                            "project_id": project.id,
                            "plugin": plugin.slug,
                        },
                    )
                rule.save()

        # disable plugin
        plugin.disable(project)
