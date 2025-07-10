from sentry import analytics


@analytics.eventclass("open_pr_comment.created")
class OpenPRCommentCreatedEvent(analytics.Event):
    comment_id: str
    org_id: str
    pr_id: str
    language: str


analytics.register(OpenPRCommentCreatedEvent)
