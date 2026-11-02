from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from uuid import UUID, uuid4, uuid5

from sentry.investigations.endpoints.serializers.orchestration import (
    orchestration_summaries_by_investigation,
)
from sentry.investigations.models import (
    InvestigationOrchestrationCommand,
    InvestigationOrchestrationCommandStatus,
    InvestigationOrchestrationPhase,
    InvestigationOrchestrationRerun,
    InvestigationOrchestrationRun,
)
from sentry.investigations.services.orchestration import (
    accept_orchestration_command,
    archive_investigation_with_orchestration,
    command_can_be_requeued,
    command_can_be_resent,
    follow_up_can_be_retried,
    rebuild_orchestration_source,
    update_investigation_with_orchestration,
)
from sentry.notebooks.endpoints.serializers.action_request import (
    InvestigationActionRequestFollowUpResponse,
)
from sentry.notebooks.endpoints.serializers.investigation import (
    InvestigationOrchestrationSerializerResponse,
)
from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.notebooks.services.action_kinds.base import (
    ApplyErrorCode,
    ApplyFailed,
    FollowUpCommand,
)
from sentry.notebooks.services.producer import NotebookProducer, NotebookProducerRun



def _queue_follow_up(
    investigation: Notebook,
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


    """Ask Seer to check its requests for this report again against the current source, and
    return the command's request ID. None if Seer would turn it down or Sentry can't rebuild
    the source.
    """

    if source is None:
        return None
    return _queue_follow_up(
        {
            "type": "recheck_action_requests",
            "payload": {
                "source": source,
            },
        },


        return None
    return InvestigationOrchestrationCommand.objects.filter(
        orchestration_run__investigation_id=action_request.notebook_id,
        request_id=action_request.followup_request_id,
        status=InvestigationOrchestrationCommandStatus.FAILED,
    ).first()







        if command_can_be_requeued(failed):
            # Seer never got it, and Sentry already moved the workflow version for it.
            accept_orchestration_command(
                request_id=failed.request_id,
                expected_workflow_version=failed.expected_workflow_version,
                command_type=failed.type,
                payload=failed.payload,
            # A new command would expect the version of a command Seer never got.
            raise ApplyFailed(
                {
                    "detail": "This goes to Seer once the command ahead of it does.",
                    "code": ApplyErrorCode.NOT_RETRYABLE,
                }
            )






    def follow_ups(
        self, item_list: Sequence[NotebookActionRequest]
    ) -> dict[tuple[int, UUID], InvestigationActionRequestFollowUpResponse]:
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



