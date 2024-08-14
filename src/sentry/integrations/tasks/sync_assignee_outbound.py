from sentry import analytics, features
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service


@instrumented_task(
    name="sentry.integrations.tasks.sync_assignee_outbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(
    exclude=(
        ExternalIssue.DoesNotExist,
        Integration.DoesNotExist,
        User.DoesNotExist,
        Organization.DoesNotExist,
    )
)
def sync_assignee_outbound(external_issue_id: int, user_id: int | None, assign: bool) -> None:
    # Sync Sentry assignee to an external issue.
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
    if not has_issue_sync:
        return
    integration = integration_service.get_integration(integration_id=external_issue.integration_id)
    if not integration:
        return

    installation = integration.get_installation(organization_id=external_issue.organization_id)
    if not (
        hasattr(installation, "should_sync") and hasattr(installation, "sync_assignee_outbound")
    ):
        return

    if installation.should_sync("outbound_assignee"):
        # Assume unassign if None.
        user = user_service.get_user(user_id) if user_id else None
        installation.sync_assignee_outbound(external_issue, user, assign=assign)
        analytics.record(
            "integration.issue.assignee.synced",
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )
