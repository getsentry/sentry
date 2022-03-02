from sentry import analytics


class CommentUpdatedEvent(analytics.Event):
    type = "comment.updated"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(CommentUpdatedEvent)
