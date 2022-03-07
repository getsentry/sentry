from sentry import analytics


class CommentCreatedEvent(analytics.Event):
    type = "comment.created"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("project_id", type=int),
        analytics.Attribute("comment_id", type=int),
        analytics.Attribute("installation_id", type=int),
    )


analytics.register(CommentCreatedEvent)
