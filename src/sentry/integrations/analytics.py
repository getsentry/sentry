from __future__ import absolute_import, print_function

from sentry import analytics


class IntegrationAddedEvent(analytics.Event):
    type = "integration.added"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
    )


class IntegrationIssueCreatedEvent(analytics.Event):
    type = "integration.issue.created"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
    )


class IntegrationIssueLinkedEvent(analytics.Event):
    type = "integration.issue.linked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
    )


class IntegrationIssueStatusSyncedEvent(analytics.Event):
    type = "integration.issue.status.synced"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


class IntegrationIssueAssigneeSyncedEvent(analytics.Event):
    type = "integration.issue.assignee.synced"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


class IntegrationIssueCommentsSyncedEvent(analytics.Event):
    type = "integration.issue.comments.synced"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


class IntegrationRepoAddedEvent(analytics.Event):
    type = "integration.repo.added"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


class IntegrationResolveCommitEvent(analytics.Event):
    type = "integration.resolve.commit"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


class IntegrationResolvePREvent(analytics.Event):
    type = "integration.resolve.pr"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(IntegrationAddedEvent)
analytics.register(IntegrationIssueCreatedEvent)
analytics.register(IntegrationIssueLinkedEvent)
analytics.register(IntegrationIssueStatusSyncedEvent)
analytics.register(IntegrationIssueAssigneeSyncedEvent)
analytics.register(IntegrationIssueCommentsSyncedEvent)
analytics.register(IntegrationRepoAddedEvent)
analytics.register(IntegrationResolveCommitEvent)
analytics.register(IntegrationResolvePREvent)
