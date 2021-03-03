from sentry import analytics


class IssueUnresolvedEvent(analytics.Event):
    type = "issue.unresolved"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("transition_type"),
    )


analytics.register(IssueUnresolvedEvent)
