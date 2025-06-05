from sentry import analytics


@analytics.eventclass("integrations.failed_to_fetch_commit_context")
class IntegrationsFailedToFetchCommitContext(analytics.Event):
    organization_id: str
    project_id: str
    code_mapping_id: str
    group_id: str
    provider: str
    error_message: str


analytics.register(IntegrationsFailedToFetchCommitContext)
