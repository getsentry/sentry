from sentry import analytics


class CommentDeletedEvent(analytics.Event):
    type = "comment.deleted"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("group_id"),
    )


analytics.register(CommentDeletedEvent)
