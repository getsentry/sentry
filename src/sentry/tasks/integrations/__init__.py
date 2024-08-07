import logging

from django.conf import settings

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


__all__ = ("logger",)

settings.CELERY_IMPORTS += (
    "sentry.tasks.integrations.create_comment",
    "sentry.tasks.integrations.github.pr_comment",
    "sentry.tasks.integrations.kick_off_status_syncs_impl",
    "sentry.tasks.integrations.link_all_repos",
    "sentry.tasks.integrations.migrate_opsgenie_plugins",
    "sentry.tasks.integrations.migrate_issues",
    "sentry.tasks.integrations.migrate_repo",
    "sentry.tasks.integrations.sync_assignee_outbound_impl",
    "sentry.tasks.integrations.sync_metadata",
    "sentry.tasks.integrations.sync_status_inbound",
    "sentry.tasks.integrations.sync_status_outbound",
    "sentry.tasks.integrations.update_comment",
    "sentry.tasks.integrations.vsts.kickoff_subscription_check",
    "sentry.tasks.integrations.vsts.subscription_check",
)
