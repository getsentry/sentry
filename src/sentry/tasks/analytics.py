from sentry import analytics


class IssueOwnersEventRatelimited(analytics.Event):
    type = "issue_owners_event.ratelimited"

    attributes = (
        analytics.Attribute("event_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(IssueOwnersEventRatelimited)
