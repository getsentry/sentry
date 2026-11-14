from __future__ import annotations

from collections.abc import Collection, Sequence
from typing import Any
from uuid import UUID, uuid4, uuid5

from django.db.models import Q

from sentry.investigations.endpoints.serializers.orchestration import (
    orchestration_summaries_by_investigation,
)
from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRerun,
    InvestigationOrchestrationRun,
    InvestigationOrchestrationStatus,
)
from sentry.investigations.seer_client import CommandRejectionCode
from sentry.investigations.services.orchestration import (
    FOLLOW_UP_COMMAND_TYPES,
    accept_orchestration_command,
    archive_investigation_with_orchestration,
    command_can_be_requeued,
    command_can_be_resent,
    follow_up_can_be_retried,
    rebuild_orchestration_source,
    update_investigation_with_orchestration,
)
from sentry.notebooks.endpoints.serializers.action_request import (
    NotebookActionRequestFollowUpResponse,
)
from sentry.notebooks.endpoints.serializers.notebook import (
    NotebookOrchestrationSerializerResponse,
)
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.notebooks.services.action_kinds.base import (
    ApplyErrorCode,
    ApplyFailed,
    FollowUpCommand,
)
from sentry.notebooks.services.producer import NotebookProducer, NotebookProducerRun
from sentry.viewer_context import ActorId

_OUTCOME_NAMESPACE = UUID("3d84e9e2-ed0b-4707-8dfc-8fce87c899ae")


def _queue_follow_up(
    investigation: Notebook,
    run: InvestigationOrchestrationRun,
    command: FollowUpCommand,
    actor_id: int | None,
) -> UUID:
    """Send Seer a command for an action request, and return its request ID. Requests that
    need the same command share it while it's queued.
    """

    # Dispatch failures are reported differently for these, so a new type has to be listed.
    assert command["type"] in FOLLOW_UP_COMMAND_TYPES
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


def _record_applied(
    investigation: Notebook,
    run: InvestigationOrchestrationRun,
    action_request: NotebookActionRequest,
    applied_by: int | None,
) -> None:
    accept_orchestration_command(
        investigation=investigation,
        request_id=uuid5(_OUTCOME_NAMESPACE, f"{action_request.id}:applied"),
        expected_workflow_version=run.workflow_version,
        command_type="record_action_outcome",
        payload={
            "key": action_request.key,
            "action": action_request.action_payload,
            "reportRevision": action_request.producer_revision,
            "outcome": "applied",
            "appliedBy": applied_by,
        },
        actor_id=applied_by,
    )


def _seer_can_recheck(
    run: InvestigationOrchestrationRun, action_request: NotebookActionRequest
) -> bool:
    # Seer turns a re-check down unless it's for the current report, and that report is done.
    report = run.projection.get("report")
    return (
        run.phase
        in (InvestigationOrchestrationPhase.METADATA, InvestigationOrchestrationPhase.COMPLETED)
        and isinstance(report, dict)
        and report.get("status") == "completed"
        and report.get("revision") == action_request.producer_revision
    )


def _queue_recheck(
    investigation: Notebook,
    run: InvestigationOrchestrationRun,
    action_request: NotebookActionRequest,
    actor_id: int,
) -> UUID | None:
    """Ask Seer to check its requests for this report again against the current source, and
    return the command's request ID. None if Seer would turn it down or Sentry can't rebuild
    the source.
    """

    if not _seer_can_recheck(run, action_request):
        return None
    source = rebuild_orchestration_source(investigation)
    if source is None:
        return None
    return _queue_follow_up(
        investigation,
        run,
        {
            "type": "recheck_action_requests",
            "payload": {
                "reportRevision": action_request.producer_revision,
                "source": source,
            },
        },
        actor_id,
    )


def _failed_follow_up(
    action_request: NotebookActionRequest,
) -> InvestigationOrchestrationCommand | None:
    if action_request.followup_request_id is None:
        return None
    return InvestigationOrchestrationCommand.objects.filter(
        orchestration_run__investigation_id=action_request.notebook_id,
        request_id=action_request.followup_request_id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
    ).first()


class OrchestrationProducerRun(NotebookProducerRun):
    def __init__(self, investigation: Notebook, run: InvestigationOrchestrationRun) -> None:
        self.investigation = investigation
        self.run = run

    def record_applied(
        self, action_request: NotebookActionRequest, *, applied_by: int | None
    ) -> None:
        _record_applied(self.investigation, self.run, action_request, applied_by)

    def queue_follow_up(self, command: FollowUpCommand, actor_id: int | None) -> UUID:
        return _queue_follow_up(self.investigation, self.run, command, actor_id)

    def queue_recheck(self, action_request: NotebookActionRequest, actor_id: int) -> UUID | None:
        return _queue_recheck(self.investigation, self.run, action_request, actor_id)

    def follow_up_failed(self, action_request: NotebookActionRequest) -> bool:
        return _failed_follow_up(action_request) is not None

    def retry_recheck(self, action_request: NotebookActionRequest, actor_id: int) -> bool:
        failed = _failed_follow_up(action_request)
        assert failed is not None
        if command_can_be_requeued(failed):
            # Seer never got it, and Sentry already moved the workflow version for it.
            accept_orchestration_command(
                investigation=self.investigation,
                request_id=failed.request_id,
                expected_workflow_version=failed.expected_workflow_version,
                command_type=failed.type,
                payload=failed.payload,
                actor_id=actor_id,
            )
            return True
        if isinstance(failed.error, dict) and failed.error.get("code") == "earlier_command_failed":
            # A new command would expect the version of a command Seer never got.
            raise ApplyFailed(
                {
                    "detail": "This goes to Seer once the command ahead of it does.",
                    "code": ApplyErrorCode.NOT_RETRYABLE,
                }
            )
        return False

    def can_resend_follow_up(self, action_request: NotebookActionRequest) -> bool:
        # One Seer turned down or dropped has a reason, and one that failed behind an
        # undelivered command goes out again when that command does.
        command = _failed_follow_up(action_request)
        return command is not None and command_can_be_resent(command.type, command.error)

    def resend_follow_up(self, action_request: NotebookActionRequest) -> None:
        command = _failed_follow_up(action_request)
        assert command is not None
        # Seer never got it, so send the same command again.
        accept_orchestration_command(
            investigation=self.investigation,
            request_id=command.request_id,
            expected_workflow_version=command.expected_workflow_version,
            command_type=command.type,
            payload=command.payload,
            actor_id=command.actor_id,
            service_account_id=command.requested_by_service_account_id,
        )


class OrchestrationProducer(NotebookProducer):
    """The hypothesis engine's hooks into the notebook API."""

    follow_up_status_hint = InvestigationOrchestrationCommandStatus
    follow_up_reason_hint = CommandRejectionCode | None
    follow_up_rerun_hint = InvestigationOrchestrationRerun | None
    run_statuses = InvestigationOrchestrationStatus.values

    def lock_run(self, notebook: Notebook, *, lock: bool) -> OrchestrationProducerRun:
        runs = InvestigationOrchestrationRun.objects.all()
        if lock:
            runs = runs.select_for_update()
        return OrchestrationProducerRun(notebook, runs.get(investigation=notebook))

    def follow_ups(
        self, item_list: Sequence[NotebookActionRequest]
    ) -> dict[tuple[int, UUID], NotebookActionRequestFollowUpResponse]:
        request_ids = {
            item.followup_request_id for item in item_list if item.followup_request_id is not None
        }
        if not request_ids:
            return {}
        return {
            (investigation_id, request_id): {
                "status": InvestigationOrchestrationCommandStatus(status),
                "reason": (error or {}).get("reason"),
                "rerun": InvestigationOrchestrationRerun(rerun) if rerun is not None else None,
                "retryable": status == InvestigationOrchestrationCommandStatus.FAILED
                and follow_up_can_be_retried(command_type, error),
            }
            for investigation_id, request_id, command_type, status, error, rerun in (
                InvestigationOrchestrationCommand.objects.filter(
                    orchestration_run__investigation_id__in={
                        item.notebook_id for item in item_list
                    },
                    request_id__in=request_ids,
                ).values_list(
                    "orchestration_run__investigation_id",
                    "request_id",
                    "type",
                    "status",
                    "error",
                    "rerun",
                )
            )
        }

    def orchestration_summaries(
        self, notebooks: Sequence[Notebook]
    ) -> dict[int, NotebookOrchestrationSerializerResponse]:
        return orchestration_summaries_by_investigation(notebooks)

    def has_run_status(self, statuses: Collection[str]) -> Q:
        return Q(orchestration_run__status__in=statuses)

    def archive_notebook(
        self, *, notebook: Notebook, expected_version: int, actor: ActorId
    ) -> Notebook:
        return archive_investigation_with_orchestration(
            investigation=notebook, expected_version=expected_version, actor=actor
        )

    def update_notebook(
        self,
        *,
        notebook: Notebook,
        expected_version: int,
        fields: dict[str, Any],
        project_ids: list[int] | None,
    ) -> Notebook:
        return update_investigation_with_orchestration(
            investigation=notebook,
            expected_version=expected_version,
            fields=fields,
            project_ids=project_ids,
        )
