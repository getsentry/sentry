from collections.abc import Sequence

from django.db import router, transaction

from sentry.inbox.notebook import (
    NOTEBOOK_TEAM_MENTIONED,
    NOTEBOOK_USER_MENTIONED,
    NotebookMentionedData,
)
from sentry.inbox.types import InboxActor
from sentry.notebooks.models import Notebook, NotebookBlock, NotebookComment
from sentry.notifications.platform.inbox import create_inbox_items
from sentry.types.actor import Actor
from sentry.utils.safe import safe_execute


def create_comment(
    *,
    notebook: Notebook,
    author_id: int,
    body: str,
    block: NotebookBlock | None = None,
    mentions: Sequence[Actor] = (),
) -> NotebookComment:
    with transaction.atomic(using=router.db_for_write(NotebookComment)):
        comment = NotebookComment.objects.create(
            notebook=notebook,
            block=block,
            author_id=author_id,
            body=body,
            mentions=[mention.dict() for mention in mentions],
        )
        data = NotebookMentionedData(comment_id=comment.id, block_id=comment.block_id)
        actor = InboxActor.user(author_id)
        safe_execute(
            create_inbox_items,
            event_type=NOTEBOOK_USER_MENTIONED,
            subject=notebook,
            data=data,
            user_ids=[mention.id for mention in mentions if mention.is_user],
            actor=actor,
        )
        safe_execute(
            create_inbox_items,
            event_type=NOTEBOOK_TEAM_MENTIONED,
            subject=notebook,
            data=data,
            team_ids=[mention.id for mention in mentions if mention.is_team],
            actor=actor,
        )
        return comment
