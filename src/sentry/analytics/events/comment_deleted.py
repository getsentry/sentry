from sentry import analytics


class CommentDeletedEvent(analytics.Event):
    type = "comment.deleted"

    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("project_id", type=int),
        analytics.Attribute("comment_id", type=int),
        analytics.Attribute("installation_id", type=int),
    )


analytics.register(CommentDeletedEvent)
