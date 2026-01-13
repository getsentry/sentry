from sentry import analytics, features
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity
from sentry.integrations.analytics import IntegrationIssueStatusSyncedEvent
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration import integration_service
from sentry.models.group import Group, GroupStatus
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationFormError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.integrations.tasks.sync_status_outbound",
    namespace=integrations_tasks,
    retry=Retry(times=5, delay=60 * 5),
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
    installation: IntegrationInstallation = integration.get_installation(
        organization_id=external_issue.organization_id
    )
    if not (hasattr(installation, "should_sync") and hasattr(installation, "sync_status_outbound")):
        return None

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.OUTBOUND_STATUS_SYNC, integration=integration
    ).capture() as lifecycle:
        lifecycle.add_extra("sync_task", "sync_status_outbound")
        try:
            if installation.should_sync("outbound_status"):
                lifecycle.add_extras(
                    {
                        "organization_id": external_issue.organization_id,
                        "integration_id": integration.id,
                        "external_issue": external_issue_id,
                        "status": group.status,
                    }
                )

                installation.sync_status_outbound(
                    external_issue, group.status == GroupStatus.RESOLVED, group.project_id
                )

                analytics.record(
                    IntegrationIssueStatusSyncedEvent(
                        provider=integration.provider,
                        id=integration.id,
                        organization_id=external_issue.organization_id,
                    )
                )
        except ApiError as e:
            # Handle 404 errors gracefully - the external issue may have been deleted
            if e.code == 404:
                lifecycle.record_halt(halt_reason=e)
                return None
            # Re-raise other ApiErrors to preserve existing behavior
            raise
        except (
            IntegrationFormError,
            ApiUnauthorized,
            OrganizationIntegrationNotFound,
            InvalidIdentity,
        ) as e:
            lifecycle.record_halt(halt_reason=e)
            return None
    return None
