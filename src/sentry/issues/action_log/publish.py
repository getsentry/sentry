"""
Publishing API for the group action log. Only top-level imports are stdlib and
action_log.types — safe to import from models and other dependency-sensitive code.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator, Sequence
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

from sentry.issues.action_log.types import (
    SYSTEM_ACTOR,
    ActionSource,
    GroupAction,
    GroupActionActor,
    GroupActionLogPayload,
)

if TYPE_CHECKING:
    from sentry.models.project import Project

logger = logging.getLogger(__name__)

# Test-only hook: notified on every publish_action() call.
_PublishCallback = Callable[["GroupAction", str, int, "Project", "GroupActionActor"], None]
_publish_callbacks: ContextVar[tuple[_PublishCallback, ...]] = ContextVar(
    "_publish_callbacks", default=()
)

# Group Action Log — tracks who did what to an issue and how.
#
# publish_action() writes a CellOutbox entry; the outbox receiver creates the
# GroupActionLogEntry on the (eventually separate) grouplog database and kicks
# off derived-data processing.
#
# Most mutation sites should use publish_action_from_context(), which reads attribution
# from a ContextVar set at the request boundary via action_context_scope().
# Use publish_action() directly only for shallow endpoint-level actions (VIEW, COMMENT, etc.).
#
# If you're adding a new caller to an instrumented function (e.g. GroupAssignee.objects.assign),
# wrap it with action_context_scope() so the action gets proper source attribution.


@dataclass(frozen=True)
class ActionContext:
    source: str
    actor: GroupActionActor = SYSTEM_ACTOR


@dataclass(frozen=True)
class _ActionPublication:
    action: GroupAction
    source: str
    group_id: int
    project: Project
    actor: GroupActionActor
    force_async_derived: bool
    idempotency_key: str | None
    date_added: datetime | None


@dataclass
class _ActionLogBuffer:
    actions: list[_ActionPublication]
    using: str
    transaction_state: tuple[bool, tuple[str | None, ...]]


class ActionLogBufferError(Exception):
    """Raised when buffered actions cannot be published on a successful scope exit."""


_action_context: ContextVar[ActionContext | None] = ContextVar("action_context", default=None)
_action_log_buffer: ContextVar[_ActionLogBuffer | None] = ContextVar(
    "action_log_buffer", default=None
)


@contextmanager
def action_context_scope(source: str, actor: GroupActionActor = SYSTEM_ACTOR) -> Generator[None]:
    """
    Set action attribution context for the duration of a block. Must be set before
    any code path that calls publish_action_from_context().
    """
    token = _action_context.set(ActionContext(source=source, actor=actor))
    try:
        yield
    finally:
        _action_context.reset(token)


def get_action_context() -> ActionContext | None:
    return _action_context.get()


def _get_transaction_state(using: str) -> tuple[bool, tuple[str | None, ...]]:
    from django.db import connections

    connection = connections[using]
    return connection.in_atomic_block, tuple(connection.savepoint_ids)


@contextmanager
def action_log_buffer() -> Generator[None]:
    """Buffer actions published at the current transaction level and flush them in bulk.

    Actions published from a nested transaction or savepoint bypass this buffer so their
    outbox rows retain the nested transaction's rollback semantics.
    """
    current_buffer = _action_log_buffer.get()
    if current_buffer is not None:
        yield
        return

    from django.db import router

    from sentry.hybridcloud.models.outbox import CellOutbox

    using = router.db_for_write(CellOutbox)
    buffer = _ActionLogBuffer(
        actions=[], using=using, transaction_state=_get_transaction_state(using)
    )
    token = _action_log_buffer.set(buffer)
    try:
        yield
    except BaseException:
        _action_log_buffer.reset(token)
        try:
            _publish_actions_bulk(buffer.actions)
        except Exception:
            logger.exception("Failed to flush group action log buffer during exception handling")
        raise
    else:
        _action_log_buffer.reset(token)
        try:
            _publish_actions_bulk(buffer.actions)
        except Exception as error:
            raise ActionLogBufferError("Failed to flush group action log buffer") from error


def _buffer_publications(publications: Sequence[_ActionPublication]) -> bool:
    buffer = _action_log_buffer.get()
    if buffer is None or _get_transaction_state(buffer.using) != buffer.transaction_state:
        return False

    buffer.actions.extend(publications)
    return True


def publish_action(
    action: GroupAction,
    *,
    source: str,
    group_id: int,
    project: Project,
    actor: GroupActionActor = SYSTEM_ACTOR,
    force_async_derived: bool = False,
    idempotency_key: str | None = None,
    date_added: datetime | None = None,
) -> None:
    """
    Record an issue action.

    Use this for shallow endpoint-level actions where the request is in scope
    (VIEW, COMMENT, TRIGGER_AUTOFIX). For mutation sites deeper in the stack,
    prefer publish_action_from_context().

    If *force_async_derived* is True, derived data processing is deferred
    entirely to the async task. Useful for latency-sensitive paths.

    If *idempotency_key* is set, the GroupActionLogEntry is created if and only if there
    does not already exist a GALE with that group id & idempotency key; else it's a no-op.

    If *date_added* is set, it records when the action occurred instead of when the outbox
    receiver processed it.

    Log publishing is managed by an outbox that flushes on commit by
    default. Wrap in ``outbox_context(flush=False)`` to defer the drain.
    """
    publication = _ActionPublication(
        action=action,
        source=source,
        group_id=group_id,
        project=project,
        actor=actor,
        force_async_derived=force_async_derived,
        idempotency_key=idempotency_key,
        date_added=date_added,
    )
    if _buffer_publications((publication,)):
        return

    _publish_action(publication)


def _publish_action(publication: _ActionPublication) -> None:
    # Deferred imports keep this module safe to import from models without creating cycles.
    from django.db import router, transaction

    from sentry import features
    from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
    from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
    from sentry.utils import metrics

    for callback in _publish_callbacks.get():
        callback(
            publication.action,
            publication.source,
            publication.group_id,
            publication.project,
            publication.actor,
        )

    action_name = publication.action.get_type().name.lower()
    write_to_db = features.has("projects:issue-action-log-write-to-db", publication.project)

    metrics.incr(
        "issues.action_log",
        tags={
            "action": action_name,
            "source": publication.source,
            "actor_type": publication.actor.actor_type.name.lower(),
            "persisted": write_to_db,
        },
    )
    logger.info(
        "group.action_log",
        extra={
            "action": action_name,
            "source": publication.source,
            # IDs are stringified so large values aren't rendered in scientific
            # notation by downstream log tooling.
            "group_id": str(publication.group_id),
            "organization_id": str(publication.project.organization_id),
            "project_id": str(publication.project.id),
            "actor_type": publication.actor.actor_type.name.lower(),
            "actor_id": str(publication.actor.actor_id),
            "metadata": publication.action.dict(),
        },
    )

    if not write_to_db:
        return

    payload: GroupActionLogPayload = {
        "group_id": publication.group_id,
        "project_id": publication.project.id,
        "type": publication.action.get_type().value,
        "actor_type": publication.actor.actor_type.value,
        "actor_id": publication.actor.actor_id,
        "source": publication.source,
        "data": publication.action.dict(),
        "force_async_derived": publication.force_async_derived,
    }

    if publication.idempotency_key is not None:
        payload["idempotency_key"] = publication.idempotency_key
    if publication.date_added is not None:
        payload["date_added"] = publication.date_added.isoformat()

    outbox = CellOutbox(
        shard_scope=OutboxScope.GROUP_SCOPE,
        shard_identifier=publication.group_id,
        category=OutboxCategory.GROUP_ACTION_LOG_EVENT,
        object_identifier=CellOutbox.next_object_identifier(),
        payload=payload,
    )
    # Flush on commit by default; callers can wrap in outbox_context(flush=False) to defer.
    with outbox_context(transaction.atomic(router.db_for_write(CellOutbox))):
        outbox.save()


def publish_action_from_context(
    action: GroupAction,
    *,
    group_id: int,
    project: Project,
    force_async_derived: bool = False,
    idempotency_key: str | None = None,
    date_added: datetime | None = None,
) -> None:
    """
    Record an issue action using the current ActionContext. This is the primary API
    for mutation sites (assign, resolve, etc.) where the request is not in scope.
    Requires action_context_scope() to have been set upstream. If context is missing,
    logs an error to Sentry and records the action with source=UNKNOWN.
    """
    ctx = get_action_context()
    if ctx is None:
        logger.error(
            "publish_action_from_context called without ActionContext",
            extra={"action": action.get_type().name.lower(), "group_id": str(group_id)},
            stack_info=True,
        )
        source: str = ActionSource.UNKNOWN
        actor = SYSTEM_ACTOR
    else:
        source = ctx.source
        actor = ctx.actor
    publish_action(
        action,
        source=source,
        group_id=group_id,
        project=project,
        actor=actor,
        force_async_derived=force_async_derived,
        idempotency_key=idempotency_key,
        date_added=date_added,
    )


def publish_actions_from_context_bulk(
    actions: Sequence[tuple[GroupAction, Project, int, str | None, datetime | None]],
    *,
    force_async_derived: bool = False,
) -> None:
    """
    Record multiple issue actions using the current ActionContext. See docstring for
    publish_action_from_context. The distinction is that this is a function to publish
    multiple GroupActions at once while only flushing the Outbox once.

    Input is a sequence of tuples of
    (GroupAction, Project, GroupID, IdempotencyKey, DateAdded).
    """
    if len(actions) == 0:
        return

    ctx = get_action_context()
    if ctx is None:
        logger.error(
            "publish_action_from_context_bulk called without ActionContext",
            extra={
                "actions": [ap[0].get_type().name.lower() for ap in actions],
            },
            stack_info=True,
        )
        source: str = ActionSource.UNKNOWN
        actor = SYSTEM_ACTOR
    else:
        source = ctx.source
        actor = ctx.actor

    publications = [
        _ActionPublication(
            action=action,
            source=source,
            group_id=group_id,
            project=project,
            actor=actor,
            force_async_derived=force_async_derived,
            idempotency_key=idempotency_key,
            date_added=date_added,
        )
        for action, project, group_id, idempotency_key, date_added in actions
    ]
    if not _buffer_publications(publications):
        _publish_actions_bulk(publications)


def _publish_actions_bulk(actions: Sequence[_ActionPublication]) -> None:
    if not actions:
        return

    from sentry.hybridcloud.models.outbox import outbox_context

    with outbox_context(flush=False):
        for action in actions[:-1]:
            _publish_action(action)

    # Flushes the outbox by default.
    _publish_action(actions[-1])
