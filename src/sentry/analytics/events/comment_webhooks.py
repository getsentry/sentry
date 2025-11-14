from typing import int
import abc

from sentry import analytics


@analytics.eventclass()
class CommentEvent(analytics.Event, abc.ABC):
    user_id: int | None = None
    group_id: int
    project_slug: str
    installation_id: int
    comment_id: int


@analytics.eventclass("comment.created")
class CommentCreatedEvent(CommentEvent):
    pass


@analytics.eventclass("comment.updated")
class CommentUpdatedEvent(CommentEvent):
    pass


@analytics.eventclass("comment.deleted")
class CommentDeletedEvent(CommentEvent):
    pass


analytics.register(CommentCreatedEvent)
analytics.register(CommentUpdatedEvent)
analytics.register(CommentDeletedEvent)
