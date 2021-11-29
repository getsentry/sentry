from typing import Optional

from sentry import analytics, features
from sentry.models import ExternalIssue, Group, GroupStatus, Integration
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation


@instrumented_task(
    name="sentry.tasks.integrations.sync_status_outbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_outbound(group_id: int, external_issue_id: int) -> Optional[bool]:
    groups = Group.objects.filter(
        id=group_id, status__in=[GroupStatus.UNRESOLVED, GroupStatus.RESOLVED]
    )
    if not groups:
        return False

    group = groups[0]
    has_issue_sync = features.has("organizations:integrations-issue-sync", group.organization)
    if not has_issue_sync:
        return False

    try:
        external_issue = ExternalIssue.objects.get(id=external_issue_id)
    except ExternalIssue.DoesNotExist:
        # Issue link could have been deleted while sync job was in the queue.
        return None

    integration = Integration.objects.get(id=external_issue.integration_id)
    installation = integration.get_installation(organization_id=external_issue.organization_id)
    if installation.should_sync("outbound_status"):
        installation.sync_status_outbound(
            external_issue, group.status == GroupStatus.RESOLVED, group.project_id
        )
        analytics.record(
            "integration.issue.status.synced",
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )
    return None
