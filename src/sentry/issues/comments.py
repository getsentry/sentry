import logging
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import timedelta
from functools import partial
from typing import Any

from django.db import router, transaction
from django.utils import timezone

from sentry.integrations.tasks.create_comment import create_comment as create_external_comment
from sentry.integrations.tasks.update_comment import update_comment as update_external_comment
from sentry.issues.action_log import GroupActionActor, action_context_scope, publish_action
from sentry.issues.action_log.types import CommentDeleteAction, CommentEditAction, SentryActorRef
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.groupsubscription import GroupSubscription
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import comment_created, comment_deleted, comment_updated
from sentry.types.activity import ActivityType
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.safe import safe_execute

logger = logging.getLogger(__name__)


@contextmanager
def _comment_transaction(group: Group) -> Generator[Group]:
    # Serialize creation/deduplication and last-comment subscription removal too.
    # Always lock Group before Activity; Activity's counter hooks update Group.
    with transaction.atomic(using=router.db_for_write(Activity)):
        yield Group.objects.select_for_update(no_key=True).get(
            id=group.id, project_id=group.project_id
        )


def _after_commit(callback: Callable[[], Any]) -> None:
    transaction.on_commit(partial(safe_execute, callback), using=router.db_for_write(Activity))


def _locked_note(note: Activity, group: Group, user: User | RpcUser) -> Activity:
    locked = Activity.objects.select_for_update().get(
        id=note.id, group_id=group.id, type=ActivityType.NOTE.value, user_id=user.id
    )
    locked.group = group
    return locked


def _webhook_data(note: Activity) -> dict[str, Any]:
    return {
        "comment_id": note.id,
        "timestamp": note.datetime,
        "comment": note.data.get("text"),
        "project_slug": note.project.slug,
    }


def _sync_comment(note: Activity, user_id: int, *, created: bool) -> None:
    assert note.group is not None
    task = create_external_comment if created else update_external_comment
    for external_issue_id in GroupLink.objects.filter(
        project_id=note.group.project_id,
        group_id=note.group_id,
        linked_type=GroupLink.LinkedType.issue,
    ).values_list("linked_id", flat=True):
        task.apply_async(
            kwargs={
                "external_issue_id": external_issue_id,
                "group_note_id": note.id,
                "user_id": user_id,
            }
        )


def create_comment(
    *,
    group: Group,
    user: User | RpcUser,
    data: dict[str, Any],
    source: str,
    from_email: bool = False,
) -> Activity | None:
    """
    Create a comment, preserving the existing inbound-email policy.

    Email deduplicates within the project without a time limit and skips subscriptions,
    integration sync, and the comment_created signal. Activity notifications still run.
    """
    with _comment_transaction(group) as group:
        duplicates = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=user.id, data=data
        )
        if from_email:
            duplicates = duplicates.filter(project_id=group.project_id)
        else:
            duplicates = duplicates.filter(datetime__gte=timezone.now() - timedelta(hours=1))
        if duplicates.exists():
            return None

        if not from_email:
            GroupSubscription.objects.subscribe(
                group=group, subscriber=user, reason=GroupSubscriptionReason.comment
            )

        with action_context_scope(source=source, actor=GroupActionActor.user(user.id)):
            note = Activity.objects.create_group_activity(
                group=group, type=ActivityType.NOTE, user_id=user.id, data=data
            )
            if not from_email:
                _after_commit(partial(_sync_comment, note, user.id, created=True))

        if not from_email:
            _after_commit(
                partial(
                    comment_created.send_robust,
                    project=group.project,
                    user=user,
                    group=group,
                    data=_webhook_data(note),
                    sender="post",
                )
            )
        return note


def update_comment(
    note: Activity,
    *,
    user: User | RpcUser,
    data: dict[str, Any],
    mentions: list[SentryActorRef],
    source: str,
    original_action_id: int | None,
) -> Activity:
    assert note.group is not None
    with _comment_transaction(note.group) as group:
        note = _locked_note(note, group, user)
        note.data.update(data)
        note.save()
        if original_action_id is not None:
            publish_action(
                CommentEditAction(
                    comment_id=original_action_id, text=data.get("text"), mentions=mentions
                ),
                source=source,
                group_id=note.group_id,
                project=group.project,
                actor=GroupActionActor.user(user.id),
            )
        else:
            logger.info(
                "group_notes.groupactionlogentry.not_found", extra={"group_id": note.group_id}
            )

        if note.data.get("external_id"):
            _after_commit(partial(_sync_comment, note, user.id, created=False))
        _after_commit(
            partial(
                comment_updated.send_robust,
                project=group.project,
                user=user,
                group=group,
                data=_webhook_data(note),
                sender="put",
            )
        )
        return note


def delete_comment(
    note: Activity, *, user: User | RpcUser, source: str, original_action_id: int | None
) -> None:
    assert note.group is not None
    with _comment_transaction(note.group) as group:
        note = _locked_note(note, group, user)
        notes_by_user = Activity.objects.filter(
            group=group, type=ActivityType.NOTE.value, user_id=user.id
        )
        last_comment = notes_by_user.count() == 1
        webhook_data = _webhook_data(note)
        note.delete()
        if original_action_id is not None:
            publish_action(
                CommentDeleteAction(comment_id=original_action_id),
                source=source,
                group_id=group.id,
                project=group.project,
                actor=GroupActionActor.user(user.id),
            )
        else:
            logger.info("group_notes.groupactionlogentry.not_found", extra={"group_id": group.id})
        _after_commit(
            partial(
                comment_deleted.send_robust,
                project=group.project,
                user=user,
                group=group,
                data=webhook_data,
                sender="delete",
            )
        )
        if last_comment:
            GroupSubscription.objects.filter(
                user_id=user.id,
                group=group,
                project=group.project,
                reason=GroupSubscriptionReason.comment,
            ).delete()


def save_external_comment_id(*, note_id: int, project_id: int, external_id: str) -> None:
    """Attach remote metadata without saving a pre-network snapshot of the note."""
    with transaction.atomic(using=router.db_for_write(Activity)):
        note = (
            Activity.objects.select_for_update()
            .filter(id=note_id, project_id=project_id, type=ActivityType.NOTE.value)
            .first()
        )
        if note is None:
            return
        note.data = {**note.data, "external_id": external_id}
        note.save(update_fields=["data"])
