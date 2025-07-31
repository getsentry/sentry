from sentry import analytics


@analytics.eventclass("open_pr_comment.created")
class OpenPRCommentCreatedEvent(analytics.Event):
    comment_id: int
    org_id: int
    pr_id: int
    language: str


analytics.register(OpenPRCommentCreatedEvent)
