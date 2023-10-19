from sentry import analytics


class IntegrationsFailedToFetchCommitContextAllFrames(analytics.Event):
    type = "integrations.failed_to_fetch_commit_context_all_frames"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("event_id"),
        analytics.Attribute("num_frames", type=int),
        analytics.Attribute("num_successfully_mapped_frames", type=int),
        analytics.Attribute("reason"),
    )


class IntegrationsSuccessfullyFetchedCommitContextAllFrames(analytics.Event):
    type = "integrations.successfully_fetched_commit_context_all_frames"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("event_id"),
        analytics.Attribute("num_frames", type=int),
        analytics.Attribute("num_unique_commits", type=int),
        analytics.Attribute("num_unique_commit_authors", type=int),
        analytics.Attribute("num_successfully_mapped_frames", type=int),
        analytics.Attribute("selected_frame_index", type=int),
        analytics.Attribute("selected_provider", type=str),
        analytics.Attribute("selected_code_mapping_id"),
    )


analytics.register(IntegrationsSuccessfullyFetchedCommitContextAllFrames)
analytics.register(IntegrationsFailedToFetchCommitContextAllFrames)
