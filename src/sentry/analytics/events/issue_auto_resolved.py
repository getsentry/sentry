from sentry import analytics


class IssueAutoResolvedEvent(analytics.Event):
    type = "issue.auto_resolved"

    attributes = (
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("issue_category", required=False),
        analytics.Attribute("issue_type", required=False),
    )


analytics.register(IssueAutoResolvedEvent)
