from typing import Any, Mapping

from sentry.models import Group, GroupStatus, Integration, Organization
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.types.activity import ActivityType


@instrumented_task(
    name="sentry.tasks.integrations.sync_status_inbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_inbound(
    integration_id: int, organization_id: int, issue_key: str, data: Mapping[str, Any]
) -> None:
    from sentry.integrations.mixins import ResolveSyncAction

    integration = Integration.objects.get(id=integration_id)
    organizations = Organization.objects.filter(id=organization_id)
    affected_groups = Group.objects.get_groups_by_external_issue(
        integration, organizations, issue_key
    )
    if not affected_groups:
        return

    installation = integration.get_installation(organization_id=organization_id)

    try:
        # This makes an API call.
        action = installation.get_resolve_sync_action(data)
    except Exception:
        return

    if action == ResolveSyncAction.RESOLVE:
        Group.objects.update_group_status(
            affected_groups, GroupStatus.RESOLVED, ActivityType.SET_RESOLVED
        )
    elif action == ResolveSyncAction.UNRESOLVE:
        Group.objects.update_group_status(
            affected_groups, GroupStatus.UNRESOLVED, ActivityType.SET_UNRESOLVED
        )
