from django.db import IntegrityError, router, transaction

from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.tasks import logger
from sentry.models.grouplink import GroupLink
from sentry.models.groupmeta import GroupMeta
from sentry.models.project import Project
from sentry.plugins.base import plugins
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.integrations.jira.tasks.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(integration_id: int, organization_id: int) -> None:
    from sentry_plugins.jira.plugin import JiraPlugin

    result = integration_service.organization_context(
        organization_id=organization_id, integration_id=integration_id
    )
    integration = result.integration
    organization_integration = result.organization_integration
    if not integration:
        raise Integration.DoesNotExist

    for project in Project.objects.filter(organization_id=organization_id):
        plugin = None
        for p in plugins.for_project(project):
            if isinstance(p, JiraPlugin) and p.is_configured(project):
                plugin = p
                break

        if not plugin:
            continue

        base_url = (integration.metadata.get("base_url") or "").rstrip("/")
        instance_url = (plugin.get_option("instance_url", project) or "").rstrip("/")
        is_different_jira_instance = base_url != instance_url

        if is_different_jira_instance:
            continue
        plugin_issues = GroupMeta.objects.filter(
            key=f"{plugin.slug}:tid", group__project__id=project.id
        )
        for plugin_issue in plugin_issues:
            external_issue, _ = ExternalIssue.objects.get_or_create(
                organization_id=organization_id,
                integration_id=integration_id,
                key=plugin_issue.value,
            )
            try:
                with transaction.atomic(router.db_for_write(GroupLink)):
                    GroupLink.objects.create(
                        group_id=plugin_issue.group_id,
                        project_id=project.id,
                        linked_type=GroupLink.LinkedType.issue,
                        linked_id=external_issue.id,
                        relationship=GroupLink.Relationship.references,
                    )
            except IntegrityError:
                continue

            plugin_issue.delete()
            logger.info(
                "plugin_issue.migrated",
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "project_id": project.id,
                    "issue_key": external_issue.key,
                    "plugin": plugin.slug,
                },
            )

            plugin_ignored_fields = plugin.get_option("ignored_fields", project)
            if organization_integration and plugin_ignored_fields:
                config = organization_integration.config
                integration_ignored_fields = organization_integration.config.get(
                    "issues_ignored_fields"
                )
                formatted_plugin_ignored_fields = {
                    x.strip() for x in plugin_ignored_fields.split(",")
                }
                update_data = None
                if integration_ignored_fields:
                    update_data = list(
                        formatted_plugin_ignored_fields | set(integration_ignored_fields)
                    )
                else:
                    update_data = list(formatted_plugin_ignored_fields)
                config.update({"issues_ignored_fields": update_data})
                integration_service.update_organization_integration(
                    org_integration_id=organization_integration.id, config=config
                )
                logger.info(
                    "plugin_ignored_fields.migrated",
                    extra={
                        "integration_id": integration_id,
                        "organization_id": organization_id,
                        "project_id": project.id,
                        "plugin": plugin.slug,
                    },
                )

        plugin.disable(project)


@instrumented_task(
    name="sentry.integrations.jira.tasks.sync_metadata",
    queue="integrations.control",
    default_retry_delay=20,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(on=(IntegrationError,), exclude=(Integration.DoesNotExist,))
def sync_metadata(integration_id: int) -> None:
    from sentry.integrations.jira.integration import JiraIntegration
    from sentry.integrations.jira_server.integration import JiraServerIntegration

    integration = Integration.objects.get(id=integration_id)
    org_install = integration.organizationintegration_set.first()
    if not org_install:
        return
    installation = integration.get_installation(org_install.organization_id)
    assert isinstance(installation, (JiraIntegration, JiraServerIntegration)), installation
    installation.sync_metadata()
