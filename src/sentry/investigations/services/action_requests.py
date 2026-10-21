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
    """Supersede live requests that belong to an older report.

    The primary request and block-anchored requests go with their report. Requests anchored
    to a hypothesis, or to nothing, stay until Seer re-sends, withdraws, or drops them from a
    snapshot, since a re-run can ask for them before its report starts.
    """

    return _supersede(
        InvestigationActionRequest.objects.filter(
            investigation=investigation, report_revision__lt=report_revision
        ).filter(Q(primary=True) | Q(anchor_type=InvestigationActionRequestAnchorType.BLOCK))
    )


def _replace_primary(investigation: Investigation, row: InvestigationActionRequest) -> None:
    """At most one live primary: the newest suggested next step.

    Seer keeps an anchored old primary as an ordinary request, so only unanchored ones go.
    """

    others = InvestigationActionRequest.objects.filter(
        investigation=investigation, primary=True, state__in=LIVE_STATES
    ).exclude(id=row.id)
    others.filter(anchor_type__isnull=False).update(primary=False, date_updated=timezone.now())
    _supersede(others.filter(anchor_type__isnull=True))


def upsert_action_request(
    run: InvestigationOrchestrationRun, item: ActionRequestItem
) -> InvestigationActionRequest:
    """Store one request by its key. The caller holds the investigation and run locks.

    Applied rows never change. A failed, withdrawn, or errored row is suggested again only when
    Seer changes its action, so replaying the same request cannot revive it.
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
    if row is None:
        row = InvestigationActionRequest.objects.create(
            investigation=investigation,
            key=item["key"],
            action_kind=action["kind"] if action is not None else None,
            action_payload=action,
            **display,
        )
    elif row.state != InvestigationActionRequestState.APPLIED:
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
        row.save(update_fields=update_fields)

    if item["primary"]:
        if row.state not in LIVE_STATES:
            # Seer should send a new key; a finished request cannot become the next step.
            logger.warning(
                "investigations.action_requests.terminal_key_reused",
                extra={"action_request_id": row.id, "state": row.state},
            )
        _replace_primary(investigation, row)
    return row


def withdraw_action_request(run: InvestigationOrchestrationRun, key: str, reason: str) -> bool:
    """Withdraw a suggested request Seer now judges wrong. Applied and failed rows keep."""

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
    """Make a snapshot's full list authoritative: live requests it omits are superseded."""

    for item in items:
        upsert_action_request(run, item)
    _supersede(
        InvestigationActionRequest.objects.filter(investigation=run.investigation).exclude(
            key__in=[item["key"] for item in items]
        )
    )
