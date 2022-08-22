from sentry import analytics


class InboxInEvent(analytics.Event):
    type = "inbox.issue_in"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("reason"),
    )


analytics.register(InboxInEvent)
