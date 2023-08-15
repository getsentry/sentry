from sentry.models import Integration, Project, Rule
from sentry.plugins.base import plugins
from sentry.services.hybrid_cloud.integration.service import integration_service
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import logger

ALERT_LEGACY_INTEGRATIONS = {
    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
    "name": "Send a notification (for all legacy integrations)",
}


@instrumented_task(
    name="sentry.tasks.integrations.migrate_alert_rules",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_alert_rules(integration_id: int, organization_id: int) -> None:
    from sentry_plugins.opsgenie.plugin import OpsGeniePlugin

    integration, organization_integration = integration_service.get_organization_context(
        organization_id=organization_id, integration_id=integration_id
    )
    if not integration:
        raise Integration.DoesNotExist

    seen_keys = {team["integration_key"] for team in organization_integration.config["team_table"]}

    for project in Project.objects.filter(organization_id=organization_id):
        plugin = None
        for p in plugins.for_project(project):
            if isinstance(p, OpsGeniePlugin) and p.is_configured(project):
                plugin = p
                break
        if not plugin:
            continue

        # migrate key
        api_key = plugin.get_option("api_key", project)
        if api_key not in seen_keys:
            seen_keys.add(api_key)
            config = organization_integration.config
            team_table = config["team_table"]
            team = {
                "team": project.name + " [MIGRATED]",
                "id": str(organization_id) + project.name,
                "integration_key": api_key,
            }
            team_table.append(team)
            config.update({"team_table": team_table})
            integration_service.update_organization_integration(
                org_integration_id=organization_integration.id, config=config
            )
        else:
            team = [team for team in team_table if team["integration_key"] == api_key][0]
        logger.info(
            "api_key.migrated",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "project_id": project.id,
                "plugin": plugin.slug,
            },
        )

        # migrate alert rules
        for rule in Rule.objects.filter(project_id=project.id):
            actions = rule.data["actions"]
            if ALERT_LEGACY_INTEGRATIONS in actions:
                actions.append(
                    {
                        "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                        "account": organization_integration.id,
                        "team": team["id"],
                    }
                )
                rule.save()
                logger.info(
                    "alert_rule.migrated",
                    extra={
                        "integration_id": integration_id,
                        "organization_id": organization_id,
                        "project_id": project.id,
                        "plugin": plugin.slug,
                    },
                )
        # disable plugin
        plugin.disable(project)
