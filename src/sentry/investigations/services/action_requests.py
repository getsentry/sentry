from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

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
)

logger = logging.getLogger(__name__)


LIVE_STATES = (
    InvestigationActionRequestState.SUGGESTED,
    InvestigationActionRequestState.FAILED,
)


def _supersede(queryset: QuerySet[InvestigationActionRequest]) -> int:
    return queryset.filter(state__in=LIVE_STATES).update(
        state=InvestigationActionRequestState.SUPERSEDED, date_updated=timezone.now()
    )


def supersede_action_requests_before(investigation: Investigation, report_revision: int) -> int:
    """Supersede requests that belonged to an older report.

    Only the primary and block-anchored requests go away with the old report. A re-run can
    ask for hypothesis and unanchored requests before its new report starts, so we keep
    those until Seer re-sends, withdraws, or leaves them out of a snapshot.
    """

    return _supersede(
        InvestigationActionRequest.objects.filter(
            investigation=investigation, report_revision__lt=report_revision
        ).filter(Q(primary=True) | Q(anchor_type=InvestigationActionRequestAnchorType.BLOCK))
    )


def _replace_primary(investigation: Investigation, row: InvestigationActionRequest) -> None:
    """Make `row` the only live primary.

    An older primary with an anchor stays as a normal request under that anchor. One without
    an anchor is superseded.
    """

    others = InvestigationActionRequest.objects.filter(
        investigation=investigation, primary=True, state__in=LIVE_STATES
    ).exclude(id=row.id)
    others.filter(anchor_type__isnull=False).update(primary=False, date_updated=timezone.now())
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
        update_fields = [*display, "date_updated"]
        for field, value in display.items():
            setattr(row, field, value)
        if row.action_payload != action:
            row.action_kind = action["kind"] if action is not None else None
            row.action_payload = action
            row.state = InvestigationActionRequestState.SUGGESTED
            row.error = None
            row.reason = None
            update_fields.extend(["action_kind", "action_payload", "state", "error", "reason"])
        elif row.state == InvestigationActionRequestState.SUPERSEDED and row.error is None:
            row.state = InvestigationActionRequestState.SUGGESTED
            update_fields.append("state")
        else:
            changed = False
        row.save(update_fields=update_fields)

    if item["primary"] and row.state not in LIVE_STATES:
        # Seer should have used a new key. A finished request can't be the next step again.
        logger.warning(
            "investigations.action_requests.terminal_key_reused",
            extra={"action_request_id": row.id, "state": row.state},
        )
    return row, changed


def withdraw_action_request(run: InvestigationOrchestrationRun, key: str, reason: str) -> bool:
    """Withdraw a suggested request that Seer no longer stands behind. Applied and failed
    requests are left alone.
    """

    return bool(
        InvestigationActionRequest.objects.filter(
            investigation=run.investigation,
            key=key,
            state=InvestigationActionRequestState.SUGGESTED,
        ).update(
            state=InvestigationActionRequestState.WITHDRAWN,
            reason=reason,
            date_updated=timezone.now(),
        )
    )


def sync_snapshot_action_requests(
    run: InvestigationOrchestrationRun, items: Sequence[ActionRequestItem]
) -> None:
    """Treat the snapshot as the full list: any live request it leaves out is superseded."""

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
    investigation: Investigation, action_request: InvestigationActionRequest, request: Request
) -> ActionKind:
    """Return the request's kind, or raise ApplyFailed if the viewer can't apply it."""

    reason = shared_cannot_apply_reason(investigation, action_request)
    if reason == CannotApplyReason.NOT_SUGGESTED:
        raise ApplyFailed(_not_suggested_error(action_request))
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


def _apply(
    *,
    investigation: Investigation,
    action_request: InvestigationActionRequest,
    request: Request,
    actor_id: int,
    dry_run: bool,
    expected_action: Mapping[str, Any] | None,
) -> InvestigationActionRequest:
    investigations = Investigation.objects.select_related("organization")
    runs = InvestigationOrchestrationRun.objects.all()
    action_requests = InvestigationActionRequest.objects.all()
    if not dry_run:
        investigations = investigations.select_for_update(of=("self",))
        runs = runs.select_for_update()
        action_requests = action_requests.select_for_update()

    locked = investigations.get(id=investigation.id)
    run = runs.get(investigation=locked)
    action_request = action_requests.get(id=action_request.id)
    kind = _check_can_apply(locked, action_request, request)
    # Seer can rewrite a suggestion under the same id, so only apply the one the user saw.
    if expected_action is not None and expected_action != action_request.action_payload:
        raise ApplyFailed(
            {
                "detail": "Seer changed this suggestion. Check the new one.",
                "code": ApplyErrorCode.ACTION_CHANGED,
            }
        )

    context = ApplyContext(
        investigation=locked,
        run=run,
        action_request=action_request,
        request=request,
        actor_id=actor_id,
    )
    try:
        if dry_run:
            kind.check(context)
            return action_request
        details = kind.apply(context)
    except ActionStale as stale:
        if not dry_run:
            # Keep the error on the row, so Seer sending the same suggestion again can't bring
            # it back.
            action_request.update(
                state=InvestigationActionRequestState.SUPERSEDED,
                error=ActionRequestError(code=ApplyErrorCode.STALE, current=stale.current),
            )
        raise ApplyFailed(
            {
                "detail": "This changed since Seer suggested it.",
                "code": ApplyErrorCode.STALE,
                "current": stale.current,
            }
        )
    except ActionInvalid as invalid:
        # The request stays suggested, so the user can try again.
        raise ApplyFailed(
            {
                "detail": "The change wasn't valid.",
                "code": ApplyErrorCode.VALIDATION_FAILED,
                "messages": invalid.messages,
            }
        )
    action_request.update(
        state=InvestigationActionRequestState.APPLIED,
        applied_by_id=actor_id,
        date_applied=timezone.now(),
        applied_details=details,
        error=None,
    )
    return action_request


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

    try:
        action_request = InvestigationActionRequest.objects.get(
            id=action_request_id, investigation=investigation
        )
    except (InvestigationActionRequest.DoesNotExist, ValueError):
        raise ResourceDoesNotExist

    using = router.db_for_write(InvestigationActionRequest)
    with transaction.atomic(using=using):
        try:
            return _apply(
                investigation=investigation,
                action_request=action_request,
                request=request,
                actor_id=actor_id,
                dry_run=dry_run,
                expected_action=expected_action,
            )
        except ApplyFailed as failed:
            error = failed
        finally:
            if dry_run:
                # The detector validator can create environments while validating.
                transaction.set_rollback(True, using=using)
    # Raise once the transaction commits, so a stale request stays superseded.
    raise error
