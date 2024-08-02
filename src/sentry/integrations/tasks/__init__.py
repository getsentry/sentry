import logging

from sentry import features
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.organization import Organization

logger = logging.getLogger("sentry.tasks.integrations")


def should_comment_sync(
    installation: IntegrationInstallation, external_issue: ExternalIssue
) -> bool:
    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
    return (
        has_issue_sync
        and hasattr(installation, "should_sync")
        and installation.should_sync("comment")
    )


from .create_comment import create_comment
from .kick_off_status_syncs import kick_off_status_syncs
from .migrate_repo import migrate_repo
from .sync_assignee_outbound import sync_assignee_outbound
from .sync_status_inbound import sync_status_inbound
from .sync_status_outbound import sync_status_outbound
from .update_comment import update_comment

__all__ = (
    "create_comment",
    "kick_off_status_syncs",
    "migrate_repo",
    "sync_assignee_outbound",
    "sync_status_inbound",
    "sync_status_outbound",
    "update_comment",
    "logger",
)
