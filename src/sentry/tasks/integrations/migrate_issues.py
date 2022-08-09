from django.db import IntegrityError, transaction

from sentry.models import ExternalIssue, Group, GroupLink, GroupMeta, Integration
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.migrate_issues",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist))
def migrate_issues(
    integration_id: int, organization_id: int, project_id: int, plugin_slug: str
) -> None:
    groups = Group.objects.filter(project=project_id)
    # this seems expensive but I don't think there are other options
    plugin_issues = GroupMeta.objects.filter(
        key=f"{plugin_slug}:tid", group__id__in=[group.id for group in groups]
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
                    project_id=project_id,
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
                "project_id": project_id,
                "issue_key": external_issue.key,
                "plugin": plugin_slug,
            },
        )
