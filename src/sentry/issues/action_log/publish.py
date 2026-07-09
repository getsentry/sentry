"""
Publishing API for the group action log. Only top-level imports are stdlib and
action_log.types — safe to import from models and other dependency-sensitive code.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
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


_action_context: ContextVar[ActionContext | None] = ContextVar("action_context", default=None)


@contextmanager
def action_context_scope(source: str, actor: GroupActionActor) -> Generator[None]:
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


def publish_action(
    action: GroupAction,
    *,
    source: str,
    group_id: int,
    project: Project,
    actor: GroupActionActor = SYSTEM_ACTOR,
    force_async_derived: bool = False,
) -> None:
    """
    Record an issue action.

    Use this for shallow endpoint-level actions where the request is in scope
    (VIEW, COMMENT, TRIGGER_AUTOFIX). For mutation sites deeper in the stack,
    prefer publish_action_from_context().

    If *force_async_derived* is True, derived data processing is deferred
    entirely to the async task. Useful for latency-sensitive paths.

    Log publishing is managed by an outbox that flushes on commit by
    default. Wrap in ``outbox_context(flush=False)`` to defer the drain.
    """
    # Deferred imports: keep this module free of Django/outbox/features deps at
    # load time so it can be imported from models without creating cycles.
    from django.db import router, transaction

    from sentry import features
    from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
    from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
    from sentry.utils import metrics

    for callback in _publish_callbacks.get():
        callback(action, source, group_id, project, actor)

    action_name = action.get_type().name.lower()
    metrics.incr(
        "issues.action_log",
        tags={
            "action": action_name,
            "source": source,
            "actor_type": actor.actor_type.name.lower(),
        },
    )
    logger.info(
        "group.action_log",
        extra={
            "action": action_name,
            "source": source,
            # IDs are stringified so large values aren't rendered in scientific
            # notation by downstream log tooling.
            "group_id": str(group_id),
            "organization_id": str(project.organization_id),
            "project_id": str(project.id),
            "actor_type": actor.actor_type.name.lower(),
            "actor_id": str(actor.actor_id),
            "metadata": action.dict(),
        },
    )

    if not features.has("projects:issue-action-log-write-to-db", project):
        return

    payload: GroupActionLogPayload = {
        "group_id": group_id,
        "project_id": project.id,
        "type": action.get_type().value,
        "actor_type": actor.actor_type.value,
        "actor_id": actor.actor_id,
        "source": source,
        "data": action.dict(),
        "force_async_derived": force_async_derived,
    }

    outbox = CellOutbox(
        shard_scope=OutboxScope.GROUP_SCOPE,
        shard_identifier=group_id,
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
    )
