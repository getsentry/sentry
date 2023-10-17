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
        analytics.Attribute("reason", type=str),
    )


analytics.register(IntegrationsFailedToFetchCommitContextAllFrames)
