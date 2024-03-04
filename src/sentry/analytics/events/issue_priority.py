from sentry import analytics


class IssueUpdatePriority(analytics.Event):
    type = "issue.update_priority"

    attributes = (
        analytics.Attribute("group_id"),
        analytics.Attribute("new_priority"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("issue_category", required=False),
        analytics.Attribute("issue_type", required=False),
        analytics.Attribute("previous_priority", required=False),
        analytics.Attribute("reason", required=False),
    )


analytics.register(IssueUpdatePriority)
