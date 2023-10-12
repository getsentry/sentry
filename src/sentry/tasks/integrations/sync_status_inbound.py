from typing import Any, Mapping

from sentry import analytics
from sentry.models.group import Group, GroupStatus
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


@instrumented_task(
    name="sentry.tasks.integrations.sync_status_inbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_inbound(
    integration_id: int, organization_id: int, issue_key: str, data: Mapping[str, Any]
) -> None:
    from sentry.integrations.mixins import ResolveSyncAction

    integration = integration_service.get_integration(integration_id=integration_id)
    if integration is None:
        raise Integration.DoesNotExist

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
            groups=affected_groups,
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=ActivityType.SET_RESOLVED,
        )

        for group in affected_groups:
            analytics.record(
                "issue.resolved",
                project_id=group.project.id,
                default_user_id=organizations[0].get_default_owner().id,
                organization_id=organization_id,
                group_id=group.id,
                resolution_type="with_third_party_app",
                issue_type=group.issue_type.slug,
                issue_category=group.issue_category.name.lower(),
            )
    elif action == ResolveSyncAction.UNRESOLVE:
        Group.objects.update_group_status(
            groups=affected_groups,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ONGOING,
            activity_type=ActivityType.SET_UNRESOLVED,
        )
