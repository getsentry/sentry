import logging

from django.db import router, transaction

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.opsgenie.metrics import record_event
from sentry.integrations.services.integration.service import integration_service
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.tasks.base import instrumented_task, retry

ALERT_LEGACY_INTEGRATIONS = {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
ALERT_LEGACY_INTEGRATIONS_WITH_NAME = {
    "id": "sentry.rules.actions.notify_event.NotifyEventAction",
    "name": "Send a notification (for all legacy integrations)",
}
logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.opsgenie.tasks.migrate_opsgenie_plugins",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist, OrganizationIntegration.DoesNotExist))
def migrate_opsgenie_plugin(integration_id: int, organization_id: int) -> None:
    with record_event(OnCallInteractionType.MIGRATE_PLUGIN).capture():
        from sentry_plugins.opsgenie.plugin import OpsGeniePlugin

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

        all_projects = Project.objects.filter(organization_id=organization_id)
        plugin = OpsGeniePlugin()
        opsgenie_projects = [
            p
            for p in all_projects
            if plugin.is_enabled(project=p) and plugin.is_configured(project=p)
        ]

        # migrate keys
        for project in opsgenie_projects:
            api_key = plugin.get_option("api_key", project)
            if seen_keys.get(api_key) is None:
                seen_keys[api_key] = len(team_table)
                team = {
                    "team": f"{project.name} [MIGRATED]",
                    "id": f"{str(organization_integration.id)}-{project.name}",
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
            "api_keys.migrated",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "plugin": plugin.slug,
            },
        )

        # migrate alert rules
        for project in opsgenie_projects:
            api_key = plugin.get_option("api_key", project)
            team = team_table[seen_keys[api_key]]
            rules_to_migrate = [
                rule
                for rule in Rule.objects.filter(project_id=project.id)
                if ALERT_LEGACY_INTEGRATIONS in rule.data["actions"]
                or ALERT_LEGACY_INTEGRATIONS_WITH_NAME in rule.data["actions"]
            ]
            with transaction.atomic(router.db_for_write(Rule)):
                for rule in rules_to_migrate:
                    actions = rule.data["actions"]
                    new_action = {
                        "id": "sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction",
                        "account": integration.id,
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
            plugin.reset_options(project)
