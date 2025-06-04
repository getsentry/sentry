from sentry import analytics


class OpenPRCommentCreatedEvent(analytics.Event):
    type = "open_pr_comment.created"

    attributes = (
        analytics.Attribute("comment_id"),
        analytics.Attribute("org_id"),
        analytics.Attribute("pr_id"),
        analytics.Attribute("language"),
    )


analytics.register(OpenPRCommentCreatedEvent)
