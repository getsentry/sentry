from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.models import (
    ExternalIssue,
    Group,
    GroupLink,
    GroupMeta,
    Integration,
    OrganizationIntegration,
    Project,
)

# from sentry import features
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
    integration = Integration.objects.get(id=integration_id)
    # installation = integration.get_installation(organization_id=organization_id)
    organization_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

    for project in Project.objects.filter(organization_id=organization_id):
        plugin = None
        for p in plugins.for_project(project):
            if p.slug.startswith(integration.provider) and p.get_option("default_project", project):
                plugin = p
                break

        if not plugin:
            continue
        if plugin.get_option("instance_url", project).rstrip("/") != integration.metadata.get(
            "base_url"
        ).rstrip("/"):
            continue

        groups = Group.objects.filter(project=project.id)
        # this seems expensive but I don't think there are other options
        plugin_issues = GroupMeta.objects.filter(
            key=f"{plugin.slug}:tid", group__id__in=[group.id for group in groups]
        )
        for plugin_issue in plugin_issues:
            external_issue, _ = ExternalIssue.objects.get_or_create(
                organization_id=organization_id,
                integration_id=integration.id,
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
                return Response({"non_field_errors": ["That issue is already linked"]}, status=400)

            plugin_issue.delete()
            logger.info(
                "plugin_issue.migrated",
                extra={
                    "integration_id": integration.id,
                    "organization_id": organization_id,
                    "project_id": project.id,
                    "issue_key": external_issue.key,
                },
            )

        # migrate ignored fields
        plugin_ignored_fields = plugin.get_option("ignored_fields", project)
        if plugin_ignored_fields:
            config = organization_integration.config
            integration_ignored_fields = organization_integration.config.get(
                "issues_ignored_fields"
            )
            formatted_plugin_ignored_fields = {x.strip() for x in plugin_ignored_fields.split(",")}
            combo = formatted_plugin_ignored_fields | set(integration_ignored_fields)
            config.update(combo)
            organization_integration.update(config=config)
            logger.info(
                "plugin_ignored_fields.migrated",
                extra={
                    "integration_id": integration.id,
                    "organization_id": organization_id,
                    "project_id": project.id,
                },
            )

        # plugin_options = ProjectOption.objects.filter(
        #     project=project.id, key__startswith=plugin.slug
        # )
        # if not plugin_options:
        #     continue

        # options_dict = {}
        # for p in plugin_options:
        #     options_dict[p.key] = p.value

        # # can I do this in another task? maybe just another function? idk
        # if plugin.get_option("auto_create") and features.has("organizations:integrations-ticket-rules", organization):
        # # TODO create alert rule using options_dict
        # # should hit some Jira endpoints to ensure options availability first

        # plugin.disable(project)
