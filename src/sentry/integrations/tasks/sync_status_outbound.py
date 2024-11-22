from sentry import analytics, features
from sentry.constants import ObjectStatus
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
    ProjectManagementHaltReason,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation


@instrumented_task(
    name="sentry.integrations.tasks.sync_status_outbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_outbound(group_id: int, external_issue_id: int) -> bool | None:
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

    integration = integration_service.get_integration(
        integration_id=external_issue.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        return None
    installation = integration.get_installation(organization_id=external_issue.organization_id)
    if not (hasattr(installation, "should_sync") and hasattr(installation, "sync_status_outbound")):
        return None

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.OUTBOUND_STATUS_SYNC, integration=integration
    ).capture() as lifecycle:
        lifecycle.add_extra("sync_task", "sync_status_outbound")
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
        else:
            # Find a way to pass further context to this in the future
            lifecycle.record_halt(
                ProjectManagementHaltReason.SYNC_INBOUND_SYNC_SKIPPED,
                extra={
                    "organization_id": external_issue.organization_id,
                    "group_id": group.id,
                },
            )
    return None
