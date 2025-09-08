from sentry import analytics


@analytics.eventclass("integrations.failed_to_fetch_commit_context_all_frames")
class IntegrationsFailedToFetchCommitContextAllFrames(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    event_id: str
    num_frames: int
    num_successfully_mapped_frames: int
    reason: str


@analytics.eventclass("integrations.successfully_fetched_commit_context_all_frames")
class IntegrationsSuccessfullyFetchedCommitContextAllFrames(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    event_id: str
    num_frames: int
    num_unique_commits: int
    num_unique_commit_authors: int
    num_successfully_mapped_frames: int
    selected_frame_index: int | None
    selected_provider: str | None
    selected_code_mapping_id: int


analytics.register(IntegrationsSuccessfullyFetchedCommitContextAllFrames)
analytics.register(IntegrationsFailedToFetchCommitContextAllFrames)
