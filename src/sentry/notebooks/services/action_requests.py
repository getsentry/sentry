from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from django.db import router, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.notebooks.contracts import ActionRequestItem
from sentry.notebooks.models import (
    Notebook,
    NotebookActionRequest,
    NotebookActionRequestAnchorType,
    NotebookActionRequestState,
)
from sentry.notebooks.services.action_kinds import get_action_kind, shared_cannot_apply_reason
from sentry.notebooks.services.action_kinds.base import (
    ActionInvalid,
    ActionKind,
    ActionRequestError,
    ActionStale,
    ApplyContext,
    ApplyError,
    ApplyErrorCode,
    ApplyFailed,
    CannotApplyReason,
    SettingValue,
)
from sentry.notebooks.services.producer import NotebookProducerRun, get_producer
from sentry.notebooks.telemetry import (
    record_action_request_applied,
    record_action_request_suggested,
)

logger = logging.getLogger(__name__)


LIVE_STATES = (
    NotebookActionRequestState.SUGGESTED,
    NotebookActionRequestState.FAILED,
)


# A request that went stale on apply. It's listed while Seer re-checks it.
STALE = Q(
    state=NotebookActionRequestState.SUPERSEDED,
    error__code=ApplyErrorCode.STALE,
    followup_request_id__isnull=False,
)


def _is_stale(row: NotebookActionRequest) -> bool:
    return (
        row.state == NotebookActionRequestState.SUPERSEDED
        and row.error is not None
        and row.error["code"] == ApplyErrorCode.STALE
        and row.followup_request_id is not None
    )


def _drop_stale(queryset: QuerySet[NotebookActionRequest]) -> None:
    # Keep the error, so Seer sending the same suggestion again can't bring it back.
    queryset.filter(STALE).update(followup_request_id=None, date_updated=timezone.now())


def _supersede(queryset: QuerySet[NotebookActionRequest]) -> int:
    _drop_stale(queryset)
    return queryset.filter(state__in=LIVE_STATES).update(
        state=NotebookActionRequestState.SUPERSEDED, date_updated=timezone.now()
    )


def supersede_action_requests_before(notebook: Notebook, report_revision: int) -> int:
    """Supersede requests that belonged to an older report.

    Only the primary and block-anchored requests go away with the old report. A re-run can
    ask for hypothesis and unanchored requests before its new report starts, so we keep
    those until Seer re-sends, withdraws, or leaves them out of a snapshot. Stale requests
    all go, since the re-check was for the old report.
    """

    older = NotebookActionRequest.objects.filter(
        notebook=notebook, producer_revision__lt=report_revision
    )
    _drop_stale(older)
    return _supersede(
        older.filter(Q(primary=True) | Q(anchor_type=NotebookActionRequestAnchorType.BLOCK))
    )


def _replace_primary(notebook: Notebook, row: NotebookActionRequest) -> None:
    """Make `row` the only live primary.

    An older primary with an anchor stays as a normal request under that anchor. One without
    an anchor is superseded, and a stale one stops being listed.
    """

    others = NotebookActionRequest.objects.filter(notebook=notebook, primary=True).exclude(
        id=row.id
    )
    _drop_stale(others)
    others.filter(anchor_type__isnull=False, state__in=LIVE_STATES).update(
        primary=False, date_updated=timezone.now()
    )
    _supersede(others.filter(anchor_type__isnull=True))


def _after_upsert(rows: Sequence[NotebookActionRequest]) -> None:
    """Call after_upsert for the requests that are still suggested."""

    if not rows:
        return
    for row in NotebookActionRequest.objects.filter(
        id__in=[row.id for row in rows], state=NotebookActionRequestState.SUGGESTED
    ).order_by("id"):
        kind = get_action_kind(row.action_kind)
        if kind is not None:
            kind.after_upsert(row)


def upsert_action_request(notebook: Notebook, item: ActionRequestItem) -> NotebookActionRequest:
    """Create or update the request with this key. Callers must hold the investigation and
    run locks.

    Applied requests are never touched. Failed, withdrawn, or errored requests only come back
    if Seer changes the action, so replaying an event can't bring them back.
    """

    row, changed = _upsert(notebook, item)
    if item["primary"]:
        _replace_primary(notebook, row)
    if changed:
        _after_upsert([row])
    return row


def _upsert(notebook: Notebook, item: ActionRequestItem) -> tuple[NotebookActionRequest, bool]:
    """Create or update the request with this key, and say whether Seer changed it."""

    anchor = item["anchor"]
    action = item["action"]
    display: dict[str, object] = {
        "producer_revision": item["reportRevision"],
        "primary": item["primary"],
        "anchor_type": anchor["type"] if anchor else None,
        "anchor_id": anchor["id"] if anchor else None,
        "title": item["title"],
        "rationale": item["rationale"],
        "impact": item["impact"],
    }
    row = NotebookActionRequest.objects.filter(notebook=notebook, key=item["key"]).first()
    changed = True
    if row is None:
        row = NotebookActionRequest.objects.create(
            notebook=notebook,
            key=item["key"],
            action_kind=action["kind"] if action is not None else None,
            action_payload=action,
            **display,
        )
        record_action_request_suggested(row)
    elif row.state == NotebookActionRequestState.APPLIED:
        changed = False
    else:
        if _is_stale(row) and row.action_payload == action:
            # Seer demotes an old primary before it sends the new one, which drops this.
            del display["primary"]
        update_fields = [*display, "date_updated"]
        for field, value in display.items():
            setattr(row, field, value)
        if row.action_payload != action:
            row.action_kind = action["kind"] if action is not None else None
            row.action_payload = action
            row.state = NotebookActionRequestState.SUGGESTED
            row.error = None
            row.reason = None
            row.followup_request_id = None
            update_fields.extend(
                ["action_kind", "action_payload", "state", "error", "reason", "followup_request_id"]
            )
            record_action_request_suggested(row)
        elif row.state == NotebookActionRequestState.SUPERSEDED and row.error is None:
            row.state = NotebookActionRequestState.SUGGESTED
            update_fields.append("state")
        else:
            changed = False
        row.save(update_fields=update_fields)

    if anchor is not None:
        # A newer request under the same anchor replaces a stale one there.
        _drop_stale(
            NotebookActionRequest.objects.filter(
                notebook=notebook,
                anchor_type=anchor["type"],
                anchor_id=anchor["id"],
                id__lt=row.id,
            )
        )

    if item["primary"] and row.state not in LIVE_STATES:
        # Seer should have used a new key. A finished request can't be the next step again.
        logger.warning(
            "investigations.action_requests.terminal_key_reused",
            extra={"action_request_id": row.id, "state": row.state},
        )
    return row, changed


def withdraw_action_request(notebook: Notebook, key: str, reason: str) -> bool:
    """Withdraw a suggested or stale request that Seer no longer stands behind. Applied and
    failed requests are left alone.
    """

    return bool(
        NotebookActionRequest.objects.filter(
            Q(state=NotebookActionRequestState.SUGGESTED) | STALE,
            notebook=notebook,
            key=key,
        ).update(
            state=NotebookActionRequestState.WITHDRAWN,
            reason=reason,
            date_updated=timezone.now(),
        )
    )


def sync_snapshot_action_requests(notebook: Notebook, items: Sequence[ActionRequestItem]) -> None:
    """Treat the snapshot as the full list: any live request it leaves out is superseded, and
    any stale one stops being listed.
    """

    primaries: list[NotebookActionRequest] = []
    changed: list[NotebookActionRequest] = []
    for item in items:
        row, row_changed = _upsert(notebook, item)
        if item["primary"]:
            primaries.append(row)
        if row_changed:
            changed.append(row)
    if primaries:
        # Pick the newest revision, then a suggested request over a failed one, then the key,
        # so the list order never decides which primary wins.
        _replace_primary(
            notebook,
            max(
                primaries,
                key=lambda row: (
                    row.producer_revision,
                    row.state == NotebookActionRequestState.SUGGESTED,
                    row.key,
                ),
            ),
        )
    _supersede(
        NotebookActionRequest.objects.filter(notebook=notebook).exclude(
            key__in=[item["key"] for item in items]
        )
    )
    _after_upsert(changed)


def supersede_block_action_requests(notebook: Notebook, block_keys: Sequence[str]) -> int:
    """Supersede the requests anchored to blocks that were just removed, since their anchor is
    gone and the UI would have nowhere to show them.
    """

    return _supersede(
        NotebookActionRequest.objects.filter(
            notebook=notebook,
            anchor_type=NotebookActionRequestAnchorType.BLOCK,
            anchor_id__in=block_keys,
        )
    )


_REASON_DETAILS = {
    CannotApplyReason.NOTEBOOK_ARCHIVED: "Archived investigations are read-only.",
    CannotApplyReason.UNSUPPORTED_ACTION: "This request has no action to apply.",
}
_DEFAULT_REASON_DETAIL = "This action can't be applied."


def _not_suggested_error(action_request: NotebookActionRequest) -> ApplyError:
    if action_request.state == NotebookActionRequestState.APPLIED:
        return {
            "detail": "This action was already applied.",
            "code": ApplyErrorCode.ALREADY_APPLIED,
        }
    if action_request.state == NotebookActionRequestState.WITHDRAWN:
        return {
            "detail": "Seer no longer suggests this.",
            "code": ApplyErrorCode.WITHDRAWN,
            "reason": action_request.reason,
        }
    return {
        "detail": "This action can no longer be applied.",
        "code": CannotApplyReason.NOT_SUGGESTED,
    }


def _check_can_apply(
    notebook: Notebook,
    action_request: NotebookActionRequest,
    request: Request,
    *,
    retry: bool = False,
) -> ActionKind[Mapping[str, object]]:
    """Return the request's kind, or raise ApplyFailed if the viewer can't apply it. A retry is
    for a request that already went stale or was applied, so its state doesn't count.
    """

    reason = shared_cannot_apply_reason(notebook, action_request)
    if reason == CannotApplyReason.NOT_SUGGESTED:
        if not retry:
            raise ApplyFailed(_not_suggested_error(action_request))
        reason = None
    if reason is None:
        kind = get_action_kind(action_request.action_kind)
        assert kind is not None
        # The same check that decides canApply guards the endpoint, so a kind can't forget it.
        reason = kind.cannot_apply_reasons(
            [action_request],
            notebooks={notebook.id: notebook},
            access=request.access,
            user=request.user,
        )[action_request.id]
        if reason is None:
            return kind
    raise ApplyFailed(
        {"detail": _REASON_DETAILS.get(reason, _DEFAULT_REASON_DETAIL), "code": reason}
    )


def _complete_action_request(
    run: NotebookProducerRun,
    action_request: NotebookActionRequest,
    *,
    applied_by: int | None,
    details: Mapping[str, object],
) -> None:
    """Record that the request was applied, and tell Seer. `applied_by` is None when Sentry
    applied it for the user. Callers hold the investigation, run, and request locks.
    """

    run.record_applied(action_request, applied_by=applied_by)
    kind = get_action_kind(action_request.action_kind)
    assert kind is not None
    command = kind.follow_up_command(action_request)
    action_request.update(
        state=NotebookActionRequestState.APPLIED,
        applied_by_id=applied_by,
        date_applied=timezone.now(),
        applied_details=details,
        error=None,
        followup_request_id=(
            run.queue_follow_up(command, applied_by) if command is not None else None
        ),
    )
    record_action_request_applied(action_request)


def complete_action_requests(
    action_requests: QuerySet[NotebookActionRequest],
    *,
    applied_by: int | None,
    details: Mapping[str, object],
) -> None:
    """Record these requests as applied and tell Seer, under the apply endpoint's locks. Use it
    when Sentry applies requests itself. Requests no one can apply now, like ones in archived
    investigations, are skipped.
    """

    notebook_ids = list(action_requests.values_list("notebook_id", flat=True).distinct())
    for notebook_id in notebook_ids:
        with transaction.atomic(using=router.db_for_write(NotebookActionRequest)):
            notebook = (
                Notebook.objects.select_for_update(of=("self",)).filter(id=notebook_id).first()
            )
            if notebook is None:
                continue
            producer = get_producer(notebook.source_type)
            if producer is None:
                continue
            run = producer.lock_run(notebook, lock=True)
            for row in action_requests.filter(notebook=notebook).select_for_update():
                if shared_cannot_apply_reason(notebook, row) is None:
                    _complete_action_request(run, row, applied_by=applied_by, details=details)


def _record_stale(context: ApplyContext, current: dict[str, SettingValue]) -> None:
    # It's listed while Seer re-checks, and the error stops Seer sending the same suggestion
    # again from bringing it back.
    context.action_request.update(
        state=NotebookActionRequestState.SUPERSEDED,
        error=ActionRequestError(code=ApplyErrorCode.STALE, current=current),
        followup_request_id=context.run.queue_recheck(context.action_request, context.actor_id),
    )


def _failed_recheck(context: ApplyContext) -> bool:
    action_request = context.action_request
    return (
        _is_stale(action_request)
        and action_request.followup_request_id is not None
        and context.run.follow_up_failed(action_request)
    )


def _undelivered_follow_up(context: ApplyContext) -> bool:
    """Whether the applied request's follow-up never reached Seer and can go out again."""

    action_request = context.action_request
    return (
        action_request.state == NotebookActionRequestState.APPLIED
        and action_request.followup_request_id is not None
        and context.run.can_resend_follow_up(action_request)
    )


def _check_without_writes(kind: ActionKind[Mapping[str, object]], context: ApplyContext) -> None:
    """Run the kind's check, and undo anything it writes."""

    using = router.db_for_write(NotebookActionRequest)
    with transaction.atomic(using=using):
        kind.check(context)
        transaction.set_rollback(True, using=using)


def _invalid_error(invalid: ActionInvalid) -> ApplyError:
    # The request stays suggested, so the user can try again.
    return {
        "detail": "The change wasn't valid.",
        "code": ApplyErrorCode.VALIDATION_FAILED,
        "messages": invalid.messages,
    }


def _check_action_unchanged(
    action_request: NotebookActionRequest, expected_action: Mapping[str, Any] | None
) -> None:
    # Seer can rewrite a suggestion under the same id, so only act on the one the user saw.
    if expected_action is not None and expected_action != action_request.action_payload:
        raise ApplyFailed(
            {
                "detail": "Seer changed this suggestion. Check the new one.",
                "code": ApplyErrorCode.ACTION_CHANGED,
            }
        )


def _locked_context(
    notebook: Notebook,
    action_request: NotebookActionRequest,
    request: Request,
    actor_id: int,
    *,
    lock: bool,
) -> ApplyContext:
    notebooks = Notebook.objects.select_related("organization")
    action_requests = NotebookActionRequest.objects.all()
    if lock:
        notebooks = notebooks.select_for_update(of=("self",))
        action_requests = action_requests.select_for_update()

    locked = notebooks.get(id=notebook.id)
    producer = get_producer(locked.source_type)
    if producer is None:
        # Only a producer's requests can be acted on.
        raise ResourceDoesNotExist
    return ApplyContext(
        notebook=locked,
        run=producer.lock_run(locked, lock=lock),
        action_request=action_requests.get(id=action_request.id),
        request=request,
        actor_id=actor_id,
    )


def _apply(
    *,
    notebook: Notebook,
    action_request: NotebookActionRequest,
    request: Request,
    actor_id: int,
    dry_run: bool,
    expected_action: Mapping[str, Any] | None,
) -> NotebookActionRequest:
    context = _locked_context(notebook, action_request, request, actor_id, lock=not dry_run)
    kind = _check_can_apply(context.notebook, context.action_request, request)
    _check_action_unchanged(context.action_request, expected_action)
    try:
        if dry_run:
            _check_without_writes(kind, context)
            return context.action_request
        details = kind.apply(context)
    except ActionStale as stale:
        if not dry_run:
            _record_stale(context, stale.current)
        raise ApplyFailed(
            {
                "detail": "This changed since Seer suggested it.",
                "code": ApplyErrorCode.STALE,
                "current": stale.current,
            }
        )
    except ActionInvalid as invalid:
        raise ApplyFailed(_invalid_error(invalid))
    _complete_action_request(
        context.run,
        context.action_request,
        applied_by=actor_id,
        details=details,
    )
    return context.action_request


def _recheck(
    *,
    notebook: Notebook,
    action_request: NotebookActionRequest,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None,
) -> NotebookActionRequest:
    context = _locked_context(notebook, action_request, request, actor_id, lock=True)
    action_request = context.action_request
    if _failed_recheck(context):
        _check_can_apply(context.notebook, action_request, request, retry=True)
        _check_action_unchanged(action_request, expected_action)
        if not context.run.retry_recheck(action_request, context.actor_id):
            assert action_request.error is not None
            _record_stale(context, action_request.error["current"])
        return action_request
    kind = _check_can_apply(context.notebook, action_request, request)
    _check_action_unchanged(action_request, expected_action)
    try:
        _check_without_writes(kind, context)
    except ActionStale as stale:
        _record_stale(context, stale.current)
        return action_request
    except ActionInvalid as invalid:
        raise ApplyFailed(_invalid_error(invalid))
    raise ApplyFailed(
        {"detail": "Nothing changed since Seer suggested this.", "code": ApplyErrorCode.NOT_STALE}
    )


def _retry_follow_up(
    *,
    notebook: Notebook,
    action_request: NotebookActionRequest,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None,
) -> NotebookActionRequest:
    context = _locked_context(notebook, action_request, request, actor_id, lock=True)
    action_request = context.action_request
    if not _undelivered_follow_up(context):
        raise ApplyFailed(
            {"detail": "There's nothing to send Seer again.", "code": ApplyErrorCode.NOT_RETRYABLE}
        )
    _check_can_apply(context.notebook, action_request, request, retry=True)
    _check_action_unchanged(action_request, expected_action)
    context.run.resend_follow_up(action_request)
    return action_request


def _get_action_request(notebook: Notebook, action_request_id: str) -> NotebookActionRequest:
    try:
        return NotebookActionRequest.objects.get(id=action_request_id, notebook=notebook)
    except (NotebookActionRequest.DoesNotExist, ValueError):
        raise ResourceDoesNotExist


def _commit_then_raise(run: Callable[[], NotebookActionRequest]) -> NotebookActionRequest:
    """Run `run` in a transaction. If it raises ApplyFailed, keep what it wrote, like a stale
    request, and raise once the transaction commits.
    """

    with transaction.atomic(using=router.db_for_write(NotebookActionRequest)):
        try:
            return run()
        except ApplyFailed as failed:
            error = failed
    raise error


def apply_action_request(
    *,
    notebook: Notebook,
    action_request_id: str,
    request: Request,
    actor_id: int,
    dry_run: bool = False,
    expected_action: Mapping[str, Any] | None = None,
) -> NotebookActionRequest:
    """Apply a suggested action as the requesting user, or raise ApplyFailed. A dry run only
    says whether it would work, and doesn't take locks or change anything.
    """

    action_request = _get_action_request(notebook, action_request_id)
    # A silo call can't run in a transaction, so check before taking locks. _apply runs the
    # guard again under them.
    kind = _check_can_apply(notebook, action_request, request)
    try:
        kind.check_remote(notebook, action_request)
    except ActionInvalid as invalid:
        raise ApplyFailed(_invalid_error(invalid))
    return _commit_then_raise(
        lambda: _apply(
            notebook=notebook,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            dry_run=dry_run,
            expected_action=expected_action,
        )
    )


def recheck_action_request(
    *,
    notebook: Notebook,
    action_request_id: str,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None = None,
) -> NotebookActionRequest:
    """If what the request changes moved since Seer suggested it, supersede it and ask Seer
    to check again. Raise ApplyFailed with `not_stale` if nothing moved. A stale request whose
    re-check failed is sent to Seer again. It never applies the change.
    """

    action_request = _get_action_request(notebook, action_request_id)
    return _commit_then_raise(
        lambda: _recheck(
            notebook=notebook,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            expected_action=expected_action,
        )
    )


def retry_follow_up(
    *,
    notebook: Notebook,
    action_request_id: str,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None = None,
) -> NotebookActionRequest:
    """Send the applied request's follow-up command to Seer again if Seer never got it, or
    raise ApplyFailed with `not_retryable`.
    """

    action_request = _get_action_request(notebook, action_request_id)
    return _commit_then_raise(
        lambda: _retry_follow_up(
            notebook=notebook,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            expected_action=expected_action,
        )
    )
