from sentry import analytics


class IssueArchivedEvent(analytics.Event):
    type = "issue.archived"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("until_escalating", type=bool, required=False),
    )


analytics.register(IssueArchivedEvent)
