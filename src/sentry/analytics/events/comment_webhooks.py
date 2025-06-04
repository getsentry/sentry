import abc

from sentry import analytics


class CommentEvent(analytics.Event, abc.ABC):
    attributes = (
        analytics.Attribute("user_id", type=int, required=False),
        analytics.Attribute("group_id", type=int),
        analytics.Attribute("project_slug", type=str),
        analytics.Attribute("installation_id", type=int),
        analytics.Attribute("comment_id", type=int),
    )


class CommentCreatedEvent(CommentEvent):
    type = "comment.created"


class CommentUpdatedEvent(CommentEvent):
    type = "comment.updated"


class CommentDeletedEvent(CommentEvent):
    type = "comment.deleted"


analytics.register(CommentCreatedEvent)
analytics.register(CommentUpdatedEvent)
analytics.register(CommentDeletedEvent)
