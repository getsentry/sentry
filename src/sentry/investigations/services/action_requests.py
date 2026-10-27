from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from typing import Any
from uuid import UUID, uuid4, uuid5

from django.db import router, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework.request import Request

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.investigations.contracts import ActionRequestItem
from sentry.investigations.models import (
    Investigation,
    InvestigationActionRequest,
    InvestigationActionRequestAnchorType,
    InvestigationActionRequestState,
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
)
from sentry.investigations.services.action_kinds import get_action_kind, shared_cannot_apply_reason
from sentry.investigations.services.action_kinds.base import (
    ActionInvalid,
    ActionKind,
    ActionRequestError,
    ActionStale,
    ApplyContext,
    ApplyError,
    ApplyErrorCode,
    ApplyFailed,
    CannotApplyReason,
    FollowUpCommand,
    SettingValue,
)
from sentry.investigations.services.orchestration import (
    accept_orchestration_command,
    command_can_be_requeued,
    command_can_be_resent,
    rebuild_orchestration_source,
)

logger = logging.getLogger(__name__)

_OUTCOME_NAMESPACE = UUID("3d84e9e2-ed0b-4707-8dfc-8fce87c899ae")


LIVE_STATES = (
    InvestigationActionRequestState.SUGGESTED,
    InvestigationActionRequestState.FAILED,
)


# A request that went stale on apply. It's listed while Seer re-checks it.
STALE = Q(
    state=InvestigationActionRequestState.SUPERSEDED,
    error__code=ApplyErrorCode.STALE,
    followup_request_id__isnull=False,
)


def _is_stale(row: InvestigationActionRequest) -> bool:
    return (
        row.state == InvestigationActionRequestState.SUPERSEDED
        and row.error is not None
        and row.error["code"] == ApplyErrorCode.STALE
        and row.followup_request_id is not None
    )


def _drop_stale(queryset: QuerySet[InvestigationActionRequest]) -> None:
    # Keep the error, so Seer sending the same suggestion again can't bring it back.
    queryset.filter(STALE).update(followup_request_id=None, date_updated=timezone.now())


def _supersede(queryset: QuerySet[InvestigationActionRequest]) -> int:
    _drop_stale(queryset)
    return queryset.filter(state__in=LIVE_STATES).update(
        state=InvestigationActionRequestState.SUPERSEDED, date_updated=timezone.now()
    )


def supersede_action_requests_before(investigation: Investigation, report_revision: int) -> int:
    """Supersede requests that belonged to an older report.

    Only the primary and block-anchored requests go away with the old report. A re-run can
    ask for hypothesis and unanchored requests before its new report starts, so we keep
    those until Seer re-sends, withdraws, or leaves them out of a snapshot. Stale requests
    all go, since the re-check was for the old report.
    """

    older = InvestigationActionRequest.objects.filter(
        investigation=investigation, report_revision__lt=report_revision
    )
    _drop_stale(older)
    return _supersede(
        older.filter(Q(primary=True) | Q(anchor_type=InvestigationActionRequestAnchorType.BLOCK))
    )


def _replace_primary(investigation: Investigation, row: InvestigationActionRequest) -> None:
    """Make `row` the only live primary.

    An older primary with an anchor stays as a normal request under that anchor. One without
    an anchor is superseded, and a stale one stops being listed.
    """

    others = InvestigationActionRequest.objects.filter(
        investigation=investigation, primary=True
    ).exclude(id=row.id)
    _drop_stale(others)
    others.filter(anchor_type__isnull=False, state__in=LIVE_STATES).update(
        primary=False, date_updated=timezone.now()
    )
    _supersede(others.filter(anchor_type__isnull=True))


def _after_upsert(rows: Sequence[InvestigationActionRequest]) -> None:
    """Call after_upsert for the requests that are still suggested."""

    if not rows:
        return
    for row in InvestigationActionRequest.objects.filter(
        id__in=[row.id for row in rows], state=InvestigationActionRequestState.SUGGESTED
    ).order_by("id"):
        kind = get_action_kind(row.action_kind)
        if kind is not None:
            kind.after_upsert(row)


def upsert_action_request(
    run: InvestigationOrchestrationRun, item: ActionRequestItem
) -> InvestigationActionRequest:
    """Create or update the request with this key. Callers must hold the investigation and
    run locks.

    Applied requests are never touched. Failed, withdrawn, or errored requests only come back
    if Seer changes the action, so replaying an event can't bring them back.
    """

    row, changed = _upsert(run, item)
    if item["primary"]:
        _replace_primary(run.investigation, row)
    if changed:
        _after_upsert([row])
    return row


def _upsert(
    run: InvestigationOrchestrationRun, item: ActionRequestItem
) -> tuple[InvestigationActionRequest, bool]:
    """Create or update the request with this key, and say whether Seer changed it."""

    investigation = run.investigation
    anchor = item["anchor"]
    action = item["action"]
    display: dict[str, object] = {
        "report_revision": item["reportRevision"],
        "primary": item["primary"],
        "anchor_type": anchor["type"] if anchor else None,
        "anchor_id": anchor["id"] if anchor else None,
        "title": item["title"],
        "rationale": item["rationale"],
        "impact": item["impact"],
    }
    row = InvestigationActionRequest.objects.filter(
        investigation=investigation, key=item["key"]
    ).first()
    changed = True
    if row is None:
        row = InvestigationActionRequest.objects.create(
            investigation=investigation,
            key=item["key"],
            action_kind=action["kind"] if action is not None else None,
            action_payload=action,
            **display,
        )
    elif row.state == InvestigationActionRequestState.APPLIED:
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
            row.state = InvestigationActionRequestState.SUGGESTED
            row.error = None
            row.reason = None
            row.followup_request_id = None
            update_fields.extend(
                ["action_kind", "action_payload", "state", "error", "reason", "followup_request_id"]
            )
        elif row.state == InvestigationActionRequestState.SUPERSEDED and row.error is None:
            row.state = InvestigationActionRequestState.SUGGESTED
            update_fields.append("state")
        else:
            changed = False
        row.save(update_fields=update_fields)

    if anchor is not None:
        # A newer request under the same anchor replaces a stale one there.
        _drop_stale(
            InvestigationActionRequest.objects.filter(
                investigation=investigation,
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


def withdraw_action_request(run: InvestigationOrchestrationRun, key: str, reason: str) -> bool:
    """Withdraw a suggested or stale request that Seer no longer stands behind. Applied and
    failed requests are left alone.
    """

    return bool(
        InvestigationActionRequest.objects.filter(
            Q(state=InvestigationActionRequestState.SUGGESTED) | STALE,
            investigation=run.investigation,
            key=key,
        ).update(
            state=InvestigationActionRequestState.WITHDRAWN,
            reason=reason,
            date_updated=timezone.now(),
        )
    )


def sync_snapshot_action_requests(
    run: InvestigationOrchestrationRun, items: Sequence[ActionRequestItem]
) -> None:
    """Treat the snapshot as the full list: any live request it leaves out is superseded, and
    any stale one stops being listed.
    """

    primaries: list[InvestigationActionRequest] = []
    changed: list[InvestigationActionRequest] = []
    for item in items:
        row, row_changed = _upsert(run, item)
        if item["primary"]:
            primaries.append(row)
        if row_changed:
            changed.append(row)
    if primaries:
        # Pick the newest revision, then a suggested request over a failed one, then the key,
        # so the list order never decides which primary wins.
        _replace_primary(
            run.investigation,
            max(
                primaries,
                key=lambda row: (
                    row.report_revision,
                    row.state == InvestigationActionRequestState.SUGGESTED,
                    row.key,
                ),
            ),
        )
    _supersede(
        InvestigationActionRequest.objects.filter(investigation=run.investigation).exclude(
            key__in=[item["key"] for item in items]
        )
    )
    _after_upsert(changed)


def supersede_block_action_requests(investigation: Investigation, block_keys: Sequence[str]) -> int:
    """Supersede the requests anchored to blocks that were just removed, since their anchor is
    gone and the UI would have nowhere to show them.
    """

    return _supersede(
        InvestigationActionRequest.objects.filter(
            investigation=investigation,
            anchor_type=InvestigationActionRequestAnchorType.BLOCK,
            anchor_id__in=block_keys,
        )
    )


_REASON_DETAILS = {
    CannotApplyReason.INVESTIGATION_ARCHIVED: "Archived investigations are read-only.",
    CannotApplyReason.UNSUPPORTED_ACTION: "This request has no action to apply.",
}
_DEFAULT_REASON_DETAIL = "This action can't be applied."


def _not_suggested_error(action_request: InvestigationActionRequest) -> ApplyError:
    if action_request.state == InvestigationActionRequestState.APPLIED:
        return {
            "detail": "This action was already applied.",
            "code": ApplyErrorCode.ALREADY_APPLIED,
        }
    if action_request.state == InvestigationActionRequestState.WITHDRAWN:
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
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    *,
    retry: bool = False,
) -> ActionKind:
    """Return the request's kind, or raise ApplyFailed if the viewer can't apply it. A retry is
    for a request that already went stale or was applied, so its state doesn't count.
    """

    reason = shared_cannot_apply_reason(investigation, action_request)
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
            investigations={investigation.id: investigation},
            access=request.access,
            user=request.user,
        )[action_request.id]
        if reason is None:
            return kind
    raise ApplyFailed(
        {"detail": _REASON_DETAILS.get(reason, _DEFAULT_REASON_DETAIL), "code": reason}
    )


def _queue_follow_up(
    investigation: Investigation,
    run: InvestigationOrchestrationRun,
    command: FollowUpCommand,
    actor_id: int | None,
) -> UUID:
    """Send Seer a command for an action request, and return its request ID. Requests that
    need the same command share it while it's queued.
    """

    queued = (
        InvestigationOrchestrationCommand.objects.filter(
            orchestration_run=run,
            type=command["type"],
            payload=command["payload"],
            status__in=(
                InvestigationOrchestrationCommandStatus.ACCEPTED,
                InvestigationOrchestrationCommandStatus.DISPATCHED,
            ),
        )
        .values_list("request_id", flat=True)
        .first()
    )
    if queued is not None:
        return queued
    return accept_orchestration_command(
        investigation=investigation,
        request_id=uuid4(),
        expected_workflow_version=run.workflow_version,
        command_type=command["type"],
        payload=command["payload"],
        actor_id=actor_id,
    ).request_id


def _complete_action_request(
    investigation: Investigation,
    run: InvestigationOrchestrationRun,
    action_request: InvestigationActionRequest,
    *,
    applied_by: int | None,
    details: Mapping[str, object],
) -> None:
    """Record that the request was applied, and tell Seer. `applied_by` is None when Sentry
    applied it for the user. Callers hold the investigation, run, and request locks.
    """

    accept_orchestration_command(
        investigation=investigation,
        request_id=uuid5(_OUTCOME_NAMESPACE, f"{action_request.id}:applied"),
        expected_workflow_version=run.workflow_version,
        command_type="record_action_outcome",
        payload={
            "key": action_request.key,
            "action": action_request.action_payload,
            "reportRevision": action_request.report_revision,
            "outcome": "applied",
            "appliedBy": applied_by,
        },
        actor_id=applied_by,
    )
    kind = get_action_kind(action_request.action_kind)
    assert kind is not None
    command = kind.follow_up_command(action_request)
    action_request.update(
        state=InvestigationActionRequestState.APPLIED,
        applied_by_id=applied_by,
        date_applied=timezone.now(),
        applied_details=details,
        error=None,
        followup_request_id=(
            _queue_follow_up(investigation, run, command, applied_by)
            if command is not None
            else None
        ),
    )


def complete_action_requests(
    action_requests: QuerySet[InvestigationActionRequest],
    *,
    applied_by: int | None,
    details: Mapping[str, object],
) -> None:
    """Record these requests as applied and tell Seer, under the apply endpoint's locks. Use it
    when Sentry applies requests itself. Requests no one can apply now, like ones in archived
    investigations, are skipped.
    """

    investigation_ids = list(action_requests.values_list("investigation_id", flat=True).distinct())
    for investigation_id in investigation_ids:
        with transaction.atomic(using=router.db_for_write(InvestigationActionRequest)):
            investigation = (
                Investigation.objects.select_for_update(of=("self",))
                .filter(id=investigation_id)
                .first()
            )
            if investigation is None:
                continue
            run = InvestigationOrchestrationRun.objects.select_for_update().get(
                investigation=investigation
            )
            for row in action_requests.filter(investigation=investigation).select_for_update():
                if shared_cannot_apply_reason(investigation, row) is None:
                    _complete_action_request(
                        investigation, run, row, applied_by=applied_by, details=details
                    )


def _seer_can_recheck(
    run: InvestigationOrchestrationRun, action_request: InvestigationActionRequest
) -> bool:
    # Seer turns a re-check down unless it's for the current report, and that report is done.
    report = run.projection.get("report")
    return (
        run.phase
        in (InvestigationOrchestrationPhase.METADATA, InvestigationOrchestrationPhase.COMPLETED)
        and isinstance(report, dict)
        and report.get("status") == "completed"
        and report.get("revision") == action_request.report_revision
    )


def _queue_recheck(context: ApplyContext) -> UUID | None:
    """Ask Seer to check its requests for this report again against the current source, and
    return the command's request ID. None if Seer would turn it down or Sentry can't rebuild
    the source.
    """

    if not _seer_can_recheck(context.run, context.action_request):
        return None
    source = rebuild_orchestration_source(context.investigation)
    if source is None:
        return None
    return _queue_follow_up(
        context.investigation,
        context.run,
        {
            "type": "recheck_action_requests",
            "payload": {"reportRevision": context.action_request.report_revision, "source": source},
        },
        context.actor_id,
    )


def _record_stale(context: ApplyContext, current: dict[str, SettingValue]) -> None:
    # It's listed while Seer re-checks, and the error stops Seer sending the same suggestion
    # again from bringing it back.
    context.action_request.update(
        state=InvestigationActionRequestState.SUPERSEDED,
        error=ActionRequestError(code=ApplyErrorCode.STALE, current=current),
        followup_request_id=_queue_recheck(context),
    )


def _failed_recheck(
    action_request: InvestigationActionRequest,
) -> InvestigationOrchestrationCommand | None:
    if not _is_stale(action_request) or action_request.followup_request_id is None:
        return None
    return InvestigationOrchestrationCommand.objects.filter(
        orchestration_run__investigation_id=action_request.investigation_id,
        request_id=action_request.followup_request_id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
    ).first()


def _undelivered_follow_up(
    action_request: InvestigationActionRequest,
) -> InvestigationOrchestrationCommand | None:
    """The applied request's follow-up, if Seer never got it and it can go out again. One Seer
    turned down or dropped has a reason, and one that failed behind an undelivered command goes
    out again when that command does.
    """

    if (
        action_request.state != InvestigationActionRequestState.APPLIED
        or action_request.followup_request_id is None
    ):
        return None
    command = InvestigationOrchestrationCommand.objects.filter(
        orchestration_run__investigation_id=action_request.investigation_id,
        request_id=action_request.followup_request_id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
    ).first()
    return (
        command
        if command is not None and command_can_be_resent(command.type, command.error)
        else None
    )


def _check_without_writes(kind: ActionKind, context: ApplyContext) -> None:
    """Run the kind's check, and undo anything it writes."""

    using = router.db_for_write(InvestigationActionRequest)
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
    action_request: InvestigationActionRequest, expected_action: Mapping[str, Any] | None
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
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    actor_id: int,
    *,
    lock: bool,
) -> ApplyContext:
    investigations = Investigation.objects.select_related("organization")
    runs = InvestigationOrchestrationRun.objects.all()
    action_requests = InvestigationActionRequest.objects.all()
    if lock:
        investigations = investigations.select_for_update(of=("self",))
        runs = runs.select_for_update()
        action_requests = action_requests.select_for_update()

    locked = investigations.get(id=investigation.id)
    return ApplyContext(
        investigation=locked,
        run=runs.get(investigation=locked),
        action_request=action_requests.get(id=action_request.id),
        request=request,
        actor_id=actor_id,
    )


def _apply(
    *,
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    actor_id: int,
    dry_run: bool,
    expected_action: Mapping[str, Any] | None,
) -> InvestigationActionRequest:
    context = _locked_context(investigation, action_request, request, actor_id, lock=not dry_run)
    kind = _check_can_apply(context.investigation, context.action_request, request)
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
        context.investigation,
        context.run,
        context.action_request,
        applied_by=actor_id,
        details=details,
    )
    return context.action_request


def _recheck(
    *,
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None,
) -> InvestigationActionRequest:
    context = _locked_context(investigation, action_request, request, actor_id, lock=True)
    action_request = context.action_request
    failed = _failed_recheck(action_request)
    if failed is not None:
        _check_can_apply(context.investigation, action_request, request, retry=True)
        _check_action_unchanged(action_request, expected_action)
        if command_can_be_requeued(failed):
            # Seer never got it, and Sentry already moved the workflow version for it.
            accept_orchestration_command(
                investigation=context.investigation,
                request_id=failed.request_id,
                expected_workflow_version=failed.expected_workflow_version,
                command_type=failed.type,
                payload=failed.payload,
                actor_id=context.actor_id,
            )
        elif (
            isinstance(failed.error, dict) and failed.error.get("code") == "earlier_command_failed"
        ):
            # A new command would expect the version of a command Seer never got.
            raise ApplyFailed(
                {
                    "detail": "This goes to Seer once the command ahead of it does.",
                    "code": ApplyErrorCode.NOT_RETRYABLE,
                }
            )
        else:
            assert action_request.error is not None
            _record_stale(context, action_request.error["current"])
        return action_request
    kind = _check_can_apply(context.investigation, action_request, request)
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
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None,
) -> InvestigationActionRequest:
    context = _locked_context(investigation, action_request, request, actor_id, lock=True)
    action_request = context.action_request
    command = _undelivered_follow_up(action_request)
    if command is None:
        raise ApplyFailed(
            {"detail": "There's nothing to send Seer again.", "code": ApplyErrorCode.NOT_RETRYABLE}
        )
    _check_can_apply(context.investigation, action_request, request, retry=True)
    _check_action_unchanged(action_request, expected_action)
    # Seer never got it, so send the same command again.
    accept_orchestration_command(
        investigation=context.investigation,
        request_id=command.request_id,
        expected_workflow_version=command.expected_workflow_version,
        command_type=command.type,
        payload=command.payload,
        actor_id=command.actor_id,
    )
    return action_request


def _get_action_request(
    investigation: Investigation, action_request_id: str
) -> InvestigationActionRequest:
    try:
        return InvestigationActionRequest.objects.get(
            id=action_request_id, investigation=investigation
        )
    except (InvestigationActionRequest.DoesNotExist, ValueError):
        raise ResourceDoesNotExist


def _commit_then_raise(run: Callable[[], InvestigationActionRequest]) -> InvestigationActionRequest:
    """Run `run` in a transaction. If it raises ApplyFailed, keep what it wrote, like a stale
    request, and raise once the transaction commits.
    """

    with transaction.atomic(using=router.db_for_write(InvestigationActionRequest)):
        try:
            return run()
        except ApplyFailed as failed:
            error = failed
    raise error


def apply_action_request(
    *,
    investigation: Investigation,
    action_request_id: str,
    request: Request,
    actor_id: int,
    dry_run: bool = False,
    expected_action: Mapping[str, Any] | None = None,
) -> InvestigationActionRequest:
    """Apply a suggested action as the requesting user, or raise ApplyFailed. A dry run only
    says whether it would work, and doesn't take locks or change anything.
    """

    action_request = _get_action_request(investigation, action_request_id)
    # A silo call can't run in a transaction, so check before taking locks. _apply runs the
    # guard again under them.
    kind = _check_can_apply(investigation, action_request, request)
    try:
        kind.check_remote(investigation, action_request)
    except ActionInvalid as invalid:
        raise ApplyFailed(_invalid_error(invalid))
    return _commit_then_raise(
        lambda: _apply(
            investigation=investigation,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            dry_run=dry_run,
            expected_action=expected_action,
        )
    )


def recheck_action_request(
    *,
    investigation: Investigation,
    action_request_id: str,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None = None,
) -> InvestigationActionRequest:
    """If what the request changes moved since Seer suggested it, supersede it and ask Seer
    to check again. Raise ApplyFailed with `not_stale` if nothing moved. A stale request whose
    re-check failed is sent to Seer again. It never applies the change.
    """

    action_request = _get_action_request(investigation, action_request_id)
    return _commit_then_raise(
        lambda: _recheck(
            investigation=investigation,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            expected_action=expected_action,
        )
    )


def retry_follow_up(
    *,
    investigation: Investigation,
    action_request_id: str,
    request: Request,
    actor_id: int,
    expected_action: Mapping[str, Any] | None = None,
) -> InvestigationActionRequest:
    """Send the applied request's follow-up command to Seer again if Seer never got it, or
    raise ApplyFailed with `not_retryable`.
    """

    action_request = _get_action_request(investigation, action_request_id)
    return _commit_then_raise(
        lambda: _retry_follow_up(
            investigation=investigation,
            action_request=action_request,
            request=request,
            actor_id=actor_id,
            expected_action=expected_action,
        )
    )
