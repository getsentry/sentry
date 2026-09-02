from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from sentry.investigations.models import (
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationRun,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.utils import json

MAX_ORCHESTRATION_EVENT_BYTES = 1024 * 1024


class InvestigationOrchestrationEventConflict(APIException):
    status_code = 409
    default_detail = "The event identity conflicts with an existing event."
    default_code = "orchestration_event_conflict"


@dataclass(frozen=True)
class OrchestrationEventReceipt:
    duplicate: bool
    application_status: str
    last_applied_sequence: int
    next_expected_sequence: int
    notebook_revision: int


__all__ = [
    "InvestigationOrchestrationEventConflict",
    "OrchestrationEventReceipt",
    "deliver_orchestration_event",
]


def _stored_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": event["schema_version"],
        "runId": event["run_id"],
        "investigationId": event["investigation_id"],
        "generation": event["generation"],
        "payload": deepcopy(event["payload"]),
    }


def deliver_orchestration_event(
    *,
    organization_id: int,
    event: dict[str, Any],
) -> OrchestrationEventReceipt:
    """Durably stage a Seer event without applying it to the run projection."""

    if len(json.dumps(event).encode()) > MAX_ORCHESTRATION_EVENT_BYTES:
        raise serializers.ValidationError({"event": "Event exceeds the maximum size."})

    stored_payload = _stored_event_payload(event)
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        try:
            run = (
                InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
                .select_related("investigation", "seer_run")
                .get(
                    investigation_id=event["investigation_id"],
                    investigation__organization_id=organization_id,
                )
            )
        except InvestigationOrchestrationRun.DoesNotExist as error:
            raise serializers.ValidationError(
                {"event": "Investigation run was not found."}
            ) from error

        if run.seer_run is not None and run.seer_run.seer_run_state_id != event["run_id"]:
            raise serializers.ValidationError({"event": "Run ID does not match."})
        if run.seer_run is None:
            # Seer can emit its first event before Sentry has committed the run id
            # its create call returned, so adopt the id from the event. get_or_create
            # keeps this idempotent with the dispatch path, whichever wins.
            seer_run, _ = SeerRun.objects.get_or_create(
                seer_run_state_id=event["run_id"],
                defaults={
                    "organization_id": organization_id,
                    "type": SeerRunType.INVESTIGATION,
                    "user_id": run.investigation.created_by_id,
                    # Adoption only happens because Seer already confirmed the
                    # run, so the mirror is live on arrival. Nothing else can
                    # advance it: the create outbox does not dispatch this type.
                    "mirror_status": SeerRunMirrorStatus.LIVE,
                    "last_triggered_at": timezone.now(),
                },
            )
            if seer_run.organization_id != organization_id:
                raise serializers.ValidationError({"event": "Run ID does not match."})
            if InvestigationOrchestrationRun.objects.filter(seer_run=seer_run).exists():
                raise InvestigationOrchestrationEventConflict("Run ID is already in use.")
            run.seer_run = seer_run
            try:
                with transaction.atomic(using=database):
                    run.save(update_fields=["seer_run", "date_updated"])
            except IntegrityError as error:
                raise InvestigationOrchestrationEventConflict(
                    "Run ID is already in use."
                ) from error

        existing = InvestigationOrchestrationEvent.objects.filter(
            orchestration_run=run,
            event_id=event["event_id"],
        ).first()
        if existing is not None:
            if (
                existing.sequence != event["sequence"]
                or existing.type != event["type"]
                or existing.payload != stored_payload
            ):
                raise InvestigationOrchestrationEventConflict
            delivered = existing
            duplicate = True
        else:
            if (
                event["sequence"] <= run.last_event_sequence
                or InvestigationOrchestrationEvent.objects.filter(
                    orchestration_run=run,
                    sequence=event["sequence"],
                ).exists()
            ):
                raise InvestigationOrchestrationEventConflict
            delivered = InvestigationOrchestrationEvent.objects.create(
                orchestration_run=run,
                event_id=event["event_id"],
                sequence=event["sequence"],
                type=event["type"],
                payload=stored_payload,
            )
            duplicate = False

        return OrchestrationEventReceipt(
            duplicate=duplicate,
            application_status=delivered.application_status,
            last_applied_sequence=run.last_event_sequence,
            next_expected_sequence=run.last_event_sequence + 1,
            notebook_revision=run.notebook_revision,
        )
