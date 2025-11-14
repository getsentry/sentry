from typing import int
from sentry import analytics


@analytics.eventclass("integrations.failed_to_fetch_commit_context")
class IntegrationsFailedToFetchCommitContext(analytics.Event):
    organization_id: int
    project_id: int
    code_mapping_id: int
    group_id: int
    provider: str
    error_message: str


analytics.register(IntegrationsFailedToFetchCommitContext)
