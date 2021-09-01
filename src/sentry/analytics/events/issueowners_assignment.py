from sentry import analytics


class IssueOwnersAssignment(analytics.Event):
    type = "issueowners.assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(IssueOwnersAssignment)
