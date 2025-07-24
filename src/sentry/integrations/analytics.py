from sentry import analytics


@analytics.eventclass("integration.added")
class IntegrationAddedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int
    user_id: int | None = None
    default_user_id: int


@analytics.eventclass("integration.disabled.notified")
class IntegrationDisabledNotified(analytics.Event):
    organization_id: int
    provider: str
    integration_type: str
    integration_id: int
    user_id: int | None = None


@analytics.eventclass("integration.issue.created")
class IntegrationIssueCreatedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int
    user_id: int | None = None
    default_user_id: int


@analytics.eventclass("integration.issue.linked")
class IntegrationIssueLinkedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int
    user_id: int | None = None
    default_user_id: int


@analytics.eventclass("integration.issue.status.synced")
class IntegrationIssueStatusSyncedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int


@analytics.eventclass("integration.issue.assignee.synced")
class IntegrationIssueAssigneeSyncedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int


@analytics.eventclass("integration.issue.comments.synced")
class IntegrationIssueCommentsSyncedEvent(analytics.Event):
    provider: str
    id: int
    organization_id: int


@analytics.eventclass("integration.repo.added")
class IntegrationRepoAddedEvent(analytics.Event):
    provider: str
    id: int | None = None
    organization_id: int


@analytics.eventclass("integration.resolve.commit")
class IntegrationResolveCommitEvent(analytics.Event):
    provider: str | None
    id: int
    organization_id: int


@analytics.eventclass("integration.resolve.pr")
class IntegrationResolvePREvent(analytics.Event):
    provider: str | None
    id: int
    organization_id: int


@analytics.eventclass("integration.stacktrace.linked")
class IntegrationStacktraceLinkEvent(analytics.Event):
    provider: str
    config_id: int
    project_id: int
    organization_id: int
    filepath: str
    status: str
    link_fetch_iterations: int
    platform: str | None = None


def register_analytics() -> None:
    analytics.register(IntegrationAddedEvent)
    analytics.register(IntegrationDisabledNotified)
    analytics.register(IntegrationIssueCreatedEvent)
    analytics.register(IntegrationIssueLinkedEvent)
    analytics.register(IntegrationIssueStatusSyncedEvent)
    analytics.register(IntegrationIssueAssigneeSyncedEvent)
    analytics.register(IntegrationIssueCommentsSyncedEvent)
    analytics.register(IntegrationRepoAddedEvent)
    analytics.register(IntegrationResolveCommitEvent)
    analytics.register(IntegrationResolvePREvent)
    analytics.register(IntegrationStacktraceLinkEvent)
