from sentry import analytics


class CommentCreatedEvent(analytics.Event):
    type = "comment.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(CommentCreatedEvent)
