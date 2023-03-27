from sentry import analytics


class IntegrationsFailedToFetchCommitContext(analytics.Event):
    type = "integrations.failed_to_fetch_commit_context"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("code_mapping_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("provider", type=str),
        analytics.Attribute("error_message", type=str),
    )


analytics.register(IntegrationsFailedToFetchCommitContext)
