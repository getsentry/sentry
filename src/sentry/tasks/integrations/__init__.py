import logging
from typing import Any

from sentry import features
from sentry.models import ExternalIssue, Organization

logger = logging.getLogger("sentry.tasks.integrations")


def should_comment_sync(installation: Any, external_issue: ExternalIssue) -> bool:
    organization = Organization.objects.get(id=external_issue.organization_id)
    has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
    return has_issue_sync and installation.should_sync("comment")


__all__ = (
    "create_comment",
    "kick_off_status_syncs",
    "kickoff_vsts_subscription_check",
    "logger",
    "migrate_repo",
    "should_comment_sync",
    "sync_assignee_outbound",
    "sync_metadata",
    "sync_status_inbound",
    "sync_status_outbound",
    "update_comment",
    "vsts_subscription_check",
)
