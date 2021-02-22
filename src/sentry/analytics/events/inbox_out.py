from sentry import analytics


class InboxOutEvent(analytics.Event):
    type = "inbox.issue_out"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("default_user_id", type=int),
        analytics.Attribute("organization_id", type=int),
        analytics.Attribute("group_id"),
        analytics.Attribute("action"),
        analytics.Attribute("inbox_in_ts", type=int),
        analytics.Attribute("referrer", required=False),
    )


analytics.register(InboxOutEvent)
