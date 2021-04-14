from sentry import analytics


class ReleaseGetPreviousCommitsEvent(analytics.Event):
    type = "release.get_previous_commits"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("user_agent", required=False),
    )


analytics.register(ReleaseGetPreviousCommitsEvent)
