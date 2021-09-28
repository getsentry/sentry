from typing import Optional

from sentry import analytics, features
from sentry.models import ExternalIssue, Integration, Organization, User
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.sync_assignee_outbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(
    exclude=(
        ExternalIssue.DoesNotExist,
        Integration.DoesNotExist,
        User.DoesNotExist,
        Organization.DoesNotExist,
    )
)
def sync_assignee_outbound(external_issue_id: int, user_id: Optional[int], assign: bool) -> None:
    # Sync Sentry assignee to an external issue.
    external_issue = ExternalIssue.objects.get(id=external_issue_id)

    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)

    if not has_issue_sync:
        return

    integration = Integration.objects.get(id=external_issue.integration_id)

    # Assume unassign if None.
    user = User.objects.get(id=user_id) if user_id else None

    installation = integration.get_installation(organization_id=external_issue.organization_id)
    if installation.should_sync("outbound_assignee"):
        installation.sync_assignee_outbound(external_issue, user, assign=assign)
        analytics.record(
            "integration.issue.assignee.synced",
            provider=integration.provider,
            id=integration.id,
            organization_id=external_issue.organization_id,
        )
