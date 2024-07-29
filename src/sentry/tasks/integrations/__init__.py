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
    return has_issue_sync and installation.should_sync("comment")


__all__ = (
    "create_comment",
    "kick_off_status_syncs",
    "kickoff_vsts_subscription_check",
    "logger",
    "migrate_opsgenie_plugin",
    "migrate_issues",
    "migrate_repo",
    "should_comment_sync",
    "sync_assignee_outbound",
    "sync_metadata",
    "sync_status_inbound",
    "sync_status_outbound",
    "update_comment",
    "vsts_subscription_check",
)


from sentry.integrations.tasks.create_comment import create_comment
from sentry.integrations.tasks.jira.sync_metadata import sync_metadata
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.integrations.tasks.migrate_repo import migrate_repo
from sentry.integrations.tasks.opsgenie.migrate_opsgenie_plugins import migrate_opsgenie_plugin
from sentry.integrations.tasks.sync_assignee_outbound import sync_assignee_outbound
from sentry.integrations.tasks.sync_status_inbound import sync_status_inbound
from sentry.integrations.tasks.sync_status_outbound import sync_status_outbound
from sentry.integrations.tasks.update_comment import update_comment
from sentry.integrations.tasks.vsts import kickoff_vsts_subscription_check, vsts_subscription_check
