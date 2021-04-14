from sentry import analytics


class ProjectIssueSearchEvent(analytics.Event):
    type = "project_issue.searched"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("query"),
    )


analytics.register(ProjectIssueSearchEvent)
