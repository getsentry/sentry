"""
Publishing API for the group action log. Only top-level imports are stdlib, Django,
and action_log.types — safe to import from models and other dependency-sensitive code.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional, Sequence

from django.db import router, transaction

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
# publish_action() writes an outbox entry; the outbox receiver creates the
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


def _prepare_action_payload(
    action: GroupAction,
    *,
    source: str,
    group_id: int,
    project: Project,
    actor: GroupActionActor,
    force_async_derived: bool,
    idempotency_key: str | None,
) -> GroupActionLogPayload | None:
    # Deferred Sentry imports keep this module safe to import from models.
    from sentry import features
    from sentry.utils import metrics

    for callback in _publish_callbacks.get():
        callback(action, source, group_id, project, actor)

    action_name = action.get_type().name.lower()
    write_to_db = features.has("projects:issue-action-log-write-to-db", project)

    metrics.incr(
        "issues.action_log",
        tags={
            "action": action_name,
            "source": source,
            "actor_type": actor.actor_type.name.lower(),
            "persisted": write_to_db,
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

    if not write_to_db:
        return None

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

    if idempotency_key is not None:
        payload["idempotency_key"] = idempotency_key

    return payload


def _resolve_outbox_model(group_id: int) -> type:
    """Choose the outbox model for a given group based on the dedicated-outbox rollout."""
    from sentry.hybridcloud.models.outbox import CellOutbox
    from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
    from sentry.options.rollout import in_rollout_group
    from sentry.utils import metrics

    use_dedicated_outbox = in_rollout_group(
        "issues.action_log.dedicated_outbox_rollout_rate", group_id
    )
    metrics.incr(
        "issues.action_log.outbox_write",
        tags={"route": "dedicated" if use_dedicated_outbox else "shared"},
    )
    return GroupActionLogOutbox if use_dedicated_outbox else CellOutbox


def publish_action(
    action: GroupAction,
    *,
    source: str,
    group_id: int,
    project: Project,
    actor: GroupActionActor = SYSTEM_ACTOR,
    force_async_derived: bool = False,
    idempotency_key: str | None = None,
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

    Log publishing is managed by an outbox that flushes on commit by
    default. Wrap in ``outbox_context(flush=False)`` to defer the drain.
    """
    # Deferred Sentry imports keep this module safe to import from models.
    from sentry.hybridcloud.models.outbox import outbox_context
    from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope

    payload = _prepare_action_payload(
        action,
        source=source,
        group_id=group_id,
        project=project,
        actor=actor,
        force_async_derived=force_async_derived,
        idempotency_key=idempotency_key,
    )
    if payload is None:
        return

    outbox_model = _resolve_outbox_model(group_id)
    outbox = outbox_model(
        shard_scope=OutboxScope.GROUP_SCOPE,
        shard_identifier=group_id,
        category=OutboxCategory.GROUP_ACTION_LOG_EVENT,
        object_identifier=outbox_model.next_object_identifier(),
        payload=payload,
    )
    # Flush on commit by default; callers can wrap in outbox_context(flush=False) to defer.
    with outbox_context(transaction.atomic(router.db_for_write(outbox_model))):
        outbox.save()


def publish_action_from_context(
    action: GroupAction,
    *,
    group_id: int,
    project: Project,
    force_async_derived: bool = False,
    idempotency_key: Optional[str] = None,
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
    )


def publish_actions_from_context_bulk(
    actions: Sequence[tuple[GroupAction, Project, int, str | None]],
    *,
    force_async_derived: bool = False,
) -> None:
    """
    Record multiple issue actions using the current ActionContext. See docstring for
    publish_action_from_context. The distinction is that this is a function to publish
    multiple GroupActions at once while scheduling at most one Outbox drain per shard.

    Input is a sequence of tuples of (GroupAction, Project, GroupID, IdempotencyKey)
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

    # Deferred Sentry imports keep this module safe to import from models.
    from sentry.hybridcloud.models.outbox import CellOutbox, InvalidOutboxError, outbox_context
    from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
    from sentry.utils import metrics

    payloads: list[GroupActionLogPayload] = []
    for action, project, group_id, idempotency_key in actions:
        payload = _prepare_action_payload(
            action,
            source=source,
            group_id=group_id,
            project=project,
            actor=actor,
            force_async_derived=force_async_derived,
            idempotency_key=idempotency_key,
        )
        if payload is not None:
            payloads.append(payload)

    if not payloads:
        return

    scope = OutboxScope.GROUP_SCOPE
    category = OutboxCategory.GROUP_ACTION_LOG_EVENT
    if not OutboxScope.scope_has_category(scope, category):
        raise InvalidOutboxError(
            f"Outbox.category {category} ({category.name}) not configured for scope {scope} ({scope.name})"
        )

    using = router.db_for_write(CellOutbox)
    with outbox_context(transaction.atomic(using=using)):
        object_identifiers = CellOutbox.reserve_object_identifiers_for_bulk_create(len(payloads))

        outboxes = [
            CellOutbox(
                shard_scope=scope,
                shard_identifier=payload["group_id"],
                category=category,
                object_identifier=object_identifier,
                payload=payload,
            )
            for object_identifier, payload in zip(object_identifiers, payloads)
        ]
        CellOutbox.objects.bulk_create(outboxes)
        # bulk_create bypasses OutboxBase.save(), including its saved metric.
        metrics.incr("outbox.saved", len(outboxes), tags={"category": category.name})

        # Ensure each affected shard is drained after the transaction commits.
        outboxes_by_shard = {
            (outbox.shard_scope, outbox.shard_identifier): outbox for outbox in outboxes
        }
        for outbox in outboxes_by_shard.values():
            outbox.schedule_drain_on_commit()
