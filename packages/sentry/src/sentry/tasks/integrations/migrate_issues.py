from django.db import IntegrityError, transaction

from sentry.models import (
    ExternalIssue,
    GroupLink,
    GroupMeta,
    Integration,
    OrganizationIntegration,
    Project,
)
from sentry.plugins.base import plugins
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(integration_id: int, organization_id: int) -> None:
    from sentry_plugins.jira.plugin import JiraPlugin

    integration = Integration.objects.get(id=integration_id)
    for project in Project.objects.filter(organization_id=organization_id):
        plugin = None
        for p in plugins.for_project(project):
            if isinstance(p, JiraPlugin) and p.is_configured(None, project):
                plugin = p
                break

        if not plugin:
            continue

        is_different_jira_instance = plugin.get_option("instance_url", project).rstrip(
            "/"
        ) != integration.metadata.get("base_url").rstrip("/")
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
                with transaction.atomic():
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
            if plugin_ignored_fields:
                organization_integration = OrganizationIntegration.objects.get(
                    integration_id=integration_id
                )
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
                organization_integration.update(config=config)
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
