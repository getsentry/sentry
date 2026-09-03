from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from django.db import IntegrityError, router, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import APIException

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    EVENT_PAYLOAD_SERIALIZERS,
    OrchestrationProjectionSerializer,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationEvent,
    InvestigationOrchestrationEventStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
    InvestigationProject,
)
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.utils import json

MAX_ORCHESTRATION_EVENT_BYTES = 1024 * 1024
_CONTROL_KEY = "_sentryControl"
_TERMINAL_STATUSES = {"completed", "failed", "cancelled"}


class InvestigationOrchestrationEventConflict(APIException):
    status_code = 409
    default_detail = "The event identity conflicts with an existing event."
    default_code = "orchestration_event_conflict"


@dataclass(frozen=True)
class OrchestrationEventReceipt:
    duplicate: bool
    application_status: str
    last_applied_sequence: int
    notebook_revision: int

    @property
    def next_expected_sequence(self) -> int:
        return self.last_applied_sequence + 1


@dataclass(frozen=True)
class _OrchestrationEventApplication:
    event: InvestigationOrchestrationEvent
    last_applied_sequence: int
    notebook_revision: int


__all__ = [
    "InvestigationOrchestrationEventConflict",
    "OrchestrationEventReceipt",
    "deliver_orchestration_event",
    "reconcile_orchestration_projection",
    "synchronize_orchestration_projection",
]


def _serialized_size(value: Any) -> int:
    return len(json.dumps(value).encode())


def _validate_projection(projection: dict[str, Any]) -> dict[str, Any]:
    validator = OrchestrationProjectionSerializer(data=projection)
    if not validator.is_valid():
        raise serializers.ValidationError({"payload": validator.errors})  # type: ignore[dict-item]
    return validator.validated_data


def _projection_evidence_project_ids(projection: dict[str, Any]) -> set[int]:
    """Collect every project the projection's evidence claims to come from.

    The projection has already been validated, so the shape is known and only the
    optional keys need guarding.
    """

    project_ids: set[int] = set()
    for hypothesis in projection.get("hypotheses", []):
        evidence_groups = [hypothesis.get("evidence", [])]
        evidence_groups.extend(
            step.get("evidence", []) for step in hypothesis.get("verificationSteps", [])
        )
        for evidence_group in evidence_groups:
            for evidence in evidence_group:
                project_ids.update(evidence.get("projectIds") or [])
    return project_ids


def _validate_projection_project_scope(
    run: InvestigationOrchestrationRun, projection: dict[str, Any]
) -> None:
    project_ids = _projection_evidence_project_ids(projection)
    if not project_ids:
        return
    allowed_project_ids = set(
        InvestigationProject.objects.filter(investigation=run.investigation).values_list(
            "project_id", flat=True
        )
    )
    if not project_ids.issubset(allowed_project_ids):
        raise serializers.ValidationError(
            {"payload": "Projection evidence is outside the investigation project scope."}
        )


def _validate_event_payload(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Check the payload against the schema for its event type and normalize it.

    Unknown fields survive validation; Seer owns the shape of these payloads and
    may add to them before Sentry knows the field exists. The return value is what
    gets staged, so the apply path reads coerced values and never re-checks types.
    """

    schema = EVENT_PAYLOAD_SERIALIZERS.get(event_type)
    if schema is None:
        return payload
    validator = schema(data=payload)
    if not validator.is_valid():
        raise serializers.ValidationError({"payload": validator.errors})
    return validator.validated_data


def _stored_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": event["schema_version"],
        "runId": event["run_id"],
        "investigationId": event["investigation_id"],
        "generation": event["generation"],
        "payload": deepcopy(event["payload"]),
    }


def _event_generation(event: InvestigationOrchestrationEvent) -> int:
    return int(event.payload["generation"])


def _event_data(event: InvestigationOrchestrationEvent) -> dict[str, Any]:
    value = event.payload.get("payload")
    return value if isinstance(value, dict) else {}


def _control(run: InvestigationOrchestrationRun) -> dict[str, Any]:
    value = run.projection.get(_CONTROL_KEY)
    if not isinstance(value, dict):
        value = {}
        run.projection[_CONTROL_KEY] = value
    return value


def _set_projection(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
    authoritative_workflow_version: bool = False,
) -> None:
    projection = _validate_projection(projection)
    _validate_projection_project_scope(run, projection)
    investigation_id = projection.get("investigationId")
    run_id = projection.get("runId")
    generation = projection.get("generation")
    if isinstance(investigation_id, bool) or not isinstance(investigation_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    if isinstance(run_id, bool) or not isinstance(run_id, int | str):
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."})
    try:
        normalized_investigation_id = int(investigation_id)
        normalized_run_id = int(run_id)
    except (TypeError, ValueError) as error:
        raise serializers.ValidationError({"payload": "Projection IDs are invalid."}) from error
    if (
        normalized_investigation_id != run.investigation_id
        or run.seer_run is None
        or normalized_run_id != run.seer_run.seer_run_state_id
        or generation != event_generation
    ):
        raise serializers.ValidationError(
            {"payload": "Projection IDs or generation do not match the event."}
        )

    previous_control = deepcopy(_control(run))
    run.projection = deepcopy(projection)
    run.projection[_CONTROL_KEY] = previous_control

    workflow_version = projection.get("workflowVersion")
    if isinstance(workflow_version, int) and not isinstance(workflow_version, bool):
        run.workflow_version = (
            workflow_version
            if authoritative_workflow_version
            else max(run.workflow_version, workflow_version)
        )
    run.generation = event_generation
    phase = projection.get("phase")
    if phase in InvestigationOrchestrationPhase.values:
        run.phase = phase
    status = projection.get("status")
    if status in InvestigationOrchestrationStatus.values:
        run.status = status
    heartbeat = projection["heartbeatAt"]
    assert isinstance(heartbeat, str)
    parsed_heartbeat = parse_datetime(heartbeat)
    assert parsed_heartbeat is not None and timezone.is_aware(parsed_heartbeat)
    run.heartbeat_at = parsed_heartbeat
    projection_error = projection.get("error")
    if projection_error is None or isinstance(projection_error, dict):
        run.error = deepcopy(projection_error)


def _projection_is_stale(
    run: InvestigationOrchestrationRun,
    projection: dict[str, Any],
    *,
    event_generation: int,
) -> bool:
    workflow_version = projection.get("workflowVersion")
    return (
        event_generation == run.generation
        and isinstance(workflow_version, int)
        and not isinstance(workflow_version, bool)
        and workflow_version < run.workflow_version
    )


def _apply_event(
    run: InvestigationOrchestrationRun, event: InvestigationOrchestrationEvent
) -> tuple[bool, str | None]:
    # Events are staged verbatim so that their identity does not move when Sentry's
    # schemas change. Normalizing here is what lets the apply path read coerced
    # values and defaults without re-checking any types.
    payload = _validate_event_payload(event.type, _event_data(event))
    generation = _event_generation(event)
    if generation < run.generation:
        return False, "stale_generation"
    if generation > run.generation and event.type not in {"workflow_updated", "state_snapshot"}:
        return False, "future_generation_without_projection"

    if event.type in {"workflow_updated", "state_snapshot"}:
        if _projection_is_stale(run, payload["projection"], event_generation=generation):
            return False, "stale_workflow_version"
        _set_projection(run, payload["projection"], event_generation=generation)
    elif event.type == "workflow_failed":
        projection = payload.get("projection")
        if projection is not None:
            _set_projection(run, projection, event_generation=generation)
    return True, None


def _is_terminal_full_snapshot(
    event: InvestigationOrchestrationEvent, run: InvestigationOrchestrationRun
) -> bool:
    if event.type != "state_snapshot":
        return False
    payload = _event_data(event)
    projection = payload.get("projection")
    return (
        payload.get("terminal") is True
        and payload.get("full") is True
        and isinstance(payload.get("blocks"), list)
        and isinstance(projection, dict)
        and projection.get("status") in _TERMINAL_STATUSES
        and projection.get("generation") == _event_generation(event)
        and not _projection_is_stale(run, projection, event_generation=_event_generation(event))
    )


def _mark_event(
    event: InvestigationOrchestrationEvent,
    status: str,
    *,
    error: dict[str, Any] | None = None,
) -> None:
    event.application_status = status
    event.error = error
    event.applied_at = timezone.now()
    event.save(update_fields=["application_status", "error", "applied_at", "date_updated"])


def _lock_run_after_investigation(
    orchestration_run_id: int,
) -> InvestigationOrchestrationRun:
    Investigation.objects.select_for_update(of=("self",)).get(
        orchestration_run__id=orchestration_run_id
    )
    return (
        InvestigationOrchestrationRun.objects.select_for_update(of=("self",))
        .select_related("investigation")
        .get(id=orchestration_run_id)
    )


def _apply_available_events(
    orchestration_run_id: int, delivered_event_id: int
) -> _OrchestrationEventApplication:
    """Consume contiguous events after rollback; only a valid terminal snapshot may skip a gap."""

    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        delivered = InvestigationOrchestrationEvent.objects.get(id=delivered_event_id)
        if delivered.sequence <= run.last_event_sequence:
            if delivered.application_status == InvestigationOrchestrationEventStatus.PENDING:
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.IGNORED,
                    error={"reason": "superseded_by_snapshot"},
                )
        elif delivered.sequence > run.last_event_sequence + 1 and _is_terminal_full_snapshot(
            delivered, run
        ):
            try:
                with transaction.atomic(using=database):
                    applied, ignored_reason = _apply_event(run, delivered)
            except serializers.ValidationError as error:
                run.refresh_from_db()
                run.investigation.refresh_from_db()
                _mark_event(
                    delivered,
                    InvestigationOrchestrationEventStatus.FAILED,
                    error={"detail": error.detail},
                )
                applied = False
                ignored_reason = None
            if not applied:
                if ignored_reason is not None:
                    _mark_event(
                        delivered,
                        InvestigationOrchestrationEventStatus.IGNORED,
                        error={"reason": ignored_reason},
                    )
                run.date_updated = timezone.now()
                run.save(update_fields=["date_updated"])
                return _OrchestrationEventApplication(
                    event=delivered,
                    last_applied_sequence=run.last_event_sequence,
                    notebook_revision=run.notebook_revision,
                )
            InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run,
                sequence__lt=delivered.sequence,
                application_status=InvestigationOrchestrationEventStatus.PENDING,
            ).update(
                application_status=InvestigationOrchestrationEventStatus.IGNORED,
                error={"reason": "superseded_by_terminal_snapshot"},
                applied_at=timezone.now(),
                date_updated=timezone.now(),
            )
            _mark_event(delivered, InvestigationOrchestrationEventStatus.APPLIED)
            run.last_event_sequence = delivered.sequence
        else:
            while True:
                next_event = InvestigationOrchestrationEvent.objects.filter(
                    orchestration_run=run,
                    sequence=run.last_event_sequence + 1,
                ).first()
                if next_event is None:
                    break
                if next_event.application_status != InvestigationOrchestrationEventStatus.PENDING:
                    run.last_event_sequence = next_event.sequence
                    continue
                try:
                    with transaction.atomic(using=database):
                        applied, ignored_reason = _apply_event(run, next_event)
                except serializers.ValidationError as error:
                    run.refresh_from_db()
                    run.investigation.refresh_from_db()
                    _mark_event(
                        next_event,
                        InvestigationOrchestrationEventStatus.FAILED,
                        error={"detail": error.detail},
                    )
                else:
                    _mark_event(
                        next_event,
                        (
                            InvestigationOrchestrationEventStatus.APPLIED
                            if applied
                            else InvestigationOrchestrationEventStatus.IGNORED
                        ),
                        error={"reason": ignored_reason} if ignored_reason else None,
                    )
                run.last_event_sequence = next_event.sequence

        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "last_event_sequence",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        delivered.refresh_from_db()
        return _OrchestrationEventApplication(
            event=delivered,
            last_applied_sequence=run.last_event_sequence,
            notebook_revision=run.notebook_revision,
        )


def _resolve_seer_run_mirror(
    *,
    seer_run_state_id: int,
    organization_id: int,
    user_id: int | None,
) -> SeerRun:
    """Find or create the SeerRun mirror for a run id Seer reported.

    Seer can report a run id before Sentry has committed the one its create call
    returned, so the mirror may not exist yet. It is live on arrival: the id only
    exists because Seer already accepted the run, and the create outbox does not
    dispatch this type, so nothing else can advance it.
    """

    seer_run, _ = SeerRun.objects.get_or_create(
        seer_run_state_id=seer_run_state_id,
        defaults={
            "organization_id": organization_id,
            "type": SeerRunType.INVESTIGATION,
            "user_id": user_id,
            "mirror_status": SeerRunMirrorStatus.LIVE,
            "last_triggered_at": timezone.now(),
        },
    )
    if seer_run.organization_id != organization_id:
        raise serializers.ValidationError({"event": "Run ID does not match."})
    return seer_run


def deliver_orchestration_event(
    *,
    organization_id: int,
    event: dict[str, Any],
) -> OrchestrationEventReceipt:
    """Stage an event, then consume contiguous work or fast-forward with a valid terminal snapshot."""

    if _serialized_size(event) > MAX_ORCHESTRATION_EVENT_BYTES:
        raise serializers.ValidationError({"event": "Event exceeds the maximum size."})
    _validate_event_payload(event["type"], event["payload"])
    stored_payload = _stored_event_payload(event)
    database = router.db_for_write(InvestigationOrchestrationRun)
    duplicate = False
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
            seer_run = _resolve_seer_run_mirror(
                seer_run_state_id=event["run_id"],
                organization_id=organization_id,
                user_id=run.investigation.created_by_id,
            )
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
            orchestration_run=run, event_id=event["event_id"]
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
            sequence_collision = InvestigationOrchestrationEvent.objects.filter(
                orchestration_run=run, sequence=event["sequence"]
            ).exists()
            if sequence_collision:
                raise InvestigationOrchestrationEventConflict
            delivered = InvestigationOrchestrationEvent.objects.create(
                orchestration_run=run,
                event_id=event["event_id"],
                sequence=event["sequence"],
                type=event["type"],
                payload=stored_payload,
            )

    outcome = _apply_available_events(run.id, delivered.id)
    return OrchestrationEventReceipt(
        duplicate=duplicate,
        application_status=outcome.event.application_status,
        last_applied_sequence=outcome.last_applied_sequence,
        notebook_revision=outcome.notebook_revision,
    )


def _synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
    authoritative: bool,
) -> InvestigationOrchestrationRun:
    if (
        isinstance(seer_run_id, bool)
        or not isinstance(seer_run_id, int)
        or not 1 <= seer_run_id <= I64_MAX
    ):
        raise serializers.ValidationError({"seer_run_id": "seer_run_id is invalid."})
    generation = projection.get("generation")
    if (
        isinstance(generation, bool)
        or not isinstance(generation, int)
        or not 1 <= generation <= I32_MAX
    ):
        raise serializers.ValidationError({"projection": "generation is invalid."})
    database = router.db_for_write(InvestigationOrchestrationRun)
    with transaction.atomic(using=database):
        run = _lock_run_after_investigation(orchestration_run_id)
        if run.seer_run is not None and run.seer_run.seer_run_state_id != seer_run_id:
            raise InvestigationOrchestrationEventConflict("Run ID does not match.")
        run.seer_run = _resolve_seer_run_mirror(
            seer_run_state_id=seer_run_id,
            organization_id=run.investigation.organization_id,
            user_id=run.investigation.created_by_id,
        )
        if authoritative or (
            generation >= run.generation
            and not _projection_is_stale(run, projection, event_generation=generation)
        ):
            _set_projection(
                run,
                projection,
                event_generation=generation,
                authoritative_workflow_version=authoritative,
            )
        run.date_updated = timezone.now()
        run.save(
            update_fields=[
                "seer_run",
                "workflow_version",
                "generation",
                "phase",
                "status",
                "projection",
                "notebook_revision",
                "heartbeat_at",
                "error",
                "date_updated",
            ]
        )
        return run


def synchronize_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Apply a monotonic create or command response without consuming callback sequence."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=False,
    )


def reconcile_orchestration_projection(
    *,
    orchestration_run_id: int,
    seer_run_id: int,
    projection: dict[str, Any],
) -> InvestigationOrchestrationRun:
    """Replace run state from an authoritative recovery response."""

    return _synchronize_orchestration_projection(
        orchestration_run_id=orchestration_run_id,
        seer_run_id=seer_run_id,
        projection=projection,
        authoritative=True,
    )
