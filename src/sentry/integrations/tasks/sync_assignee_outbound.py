from typing import Any

from sentry import analytics, features
from sentry.constants import ObjectStatus
from sentry.integrations.analytics import IntegrationIssueAssigneeSyncedEvent
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationError,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service


@instrumented_task(
    name="sentry.integrations.tasks.sync_assignee_outbound",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=5, delay=60 * 5),
    silo_mode=SiloMode.REGION,
)
@retry(
    exclude=(
        ExternalIssue.DoesNotExist,
        Integration.DoesNotExist,
        User.DoesNotExist,
        Organization.DoesNotExist,
        IntegrationError,
    )
)
def sync_assignee_outbound(
    external_issue_id: int,
    user_id: int | None,
    assign: bool,
    assignment_source_dict: dict[str, Any] | None = None,
) -> None:
    from sentry.integrations.mixins.issues import IntegrationSyncTargetNotFound

    # Sync Sentry assignee to an external issue.
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
    if not has_issue_sync:
        return
    integration = integration_service.get_integration(
        integration_id=external_issue.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        return

    installation = integration.get_installation(organization_id=external_issue.organization_id)

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.OUTBOUND_ASSIGNMENT_SYNC, integration=integration
    ).capture() as lifecycle:
        lifecycle.add_extra("sync_task", "sync_assignee_outbound")
        lifecycle.add_extra("organization_id", external_issue.organization_id)
        lifecycle.add_extra("integration_id", integration.id)

        if not (
            hasattr(installation, "should_sync") and hasattr(installation, "sync_assignee_outbound")
        ):
            return

        try:
            parsed_assignment_source = (
                AssignmentSource.from_dict(assignment_source_dict)
                if assignment_source_dict
                else None
            )
            if installation.should_sync("outbound_assignee", parsed_assignment_source):
                # Assume unassign if None.
                user = user_service.get_user(user_id) if user_id else None
                installation.sync_assignee_outbound(
                    external_issue, user, assign=assign, assignment_source=parsed_assignment_source
                )
                analytics.record(
                    IntegrationIssueAssigneeSyncedEvent(
                        provider=integration.provider,
                        id=integration.id,
                        organization_id=external_issue.organization_id,
                    )
                )
        except ApiError as e:
            # Handle 404 errors gracefully - the external issue may have been deleted
            if e.code == 404:
                lifecycle.record_halt(halt_reason=e)
                return
            # Re-raise other ApiErrors to preserve existing behavior
            raise
        except (
            OrganizationIntegrationNotFound,
            ApiUnauthorized,
            IntegrationSyncTargetNotFound,
            IntegrationConfigurationError,
        ) as e:
            lifecycle.record_halt(halt_reason=e)
