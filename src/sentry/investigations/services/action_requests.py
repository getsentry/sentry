from __future__ import annotations

import logging
from collections.abc import Sequence

from django.db.models import Q, QuerySet
from django.utils import timezone

from sentry.investigations.contracts import ActionRequestItem
from sentry.investigations.models import (
    Investigation,
    InvestigationActionRequest,
    InvestigationActionRequestAnchorType,
    InvestigationActionRequestState,
    InvestigationOrchestrationRun,
)
from sentry.investigations.services.action_kinds import get_action_kind

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


def upsert_action_request(
    run: InvestigationOrchestrationRun, item: ActionRequestItem, *, replace_primary: bool = True
) -> InvestigationActionRequest:
    """Create or update the request with this key. Callers must hold the investigation and
    run locks.

    Applied requests are never touched. Failed, withdrawn, or errored requests only come back
    if Seer changes the action, so replaying an event can't bring them back.
    """

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

    if item["primary"]:
        if row.state not in LIVE_STATES:
            # Seer should have used a new key. A finished request can't be the next step again.
            logger.warning(
                "investigations.action_requests.terminal_key_reused",
                extra={"action_request_id": row.id, "state": row.state},
            )
        if replace_primary:
            _replace_primary(investigation, row)
    kind = get_action_kind(row.action_kind)
    if changed and kind is not None and row.state == InvestigationActionRequestState.SUGGESTED:
        kind.after_upsert(row)
    return row


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
    for item in items:
        row = upsert_action_request(run, item, replace_primary=False)
        if item["primary"]:
            primaries.append(row)
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
