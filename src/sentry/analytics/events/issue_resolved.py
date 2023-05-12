from sentry import analytics


class IssueResolvedEvent(analytics.Event):
    type = "issue.resolved"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("resolution_type"),
        # TODO: make required once we validate that all events have this
        analytics.Attribute("issue_category", required=False),
        analytics.Attribute("issue_type", required=False),
    )


analytics.register(IssueResolvedEvent)
