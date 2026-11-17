from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal

from django.db import router
from django.utils import timezone
from pydantic import BaseModel, Field

from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    WorkflowRunError,
    WorkflowRunSnapshot,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle

RejectionReason = Literal["quota_exceeded"]


class AcceptedAdmission(BaseModel):
    status: Literal["accepted"] = "accepted"
    reason: None = None
    decided_at: datetime


class RejectedAdmission(BaseModel):
    status: Literal["rejected"] = "rejected"
    reason: RejectionReason
    decided_at: datetime


RunAdmission = Annotated[AcceptedAdmission | RejectedAdmission, Field(discriminator="status")]


class AdmittedRunExtras(SeerWorkflowRunExtras):
    admission: RunAdmission


@dataclass(frozen=True)
class AdmittedRun:
    lifecycle: SeerWorkflowRunLifecycle
    # False when the trigger key already had a run, which keeps its original decision.
    created: bool
    rejection: RejectionReason | None = None


def has_quota_available(config: SeerWorkflowConfig) -> bool:
    # TODO(telkins): Enforce automation quota before accepting a new run.
    return True


def admit_run(
    config: SeerWorkflowConfig,
    *,
    trigger_key: str,
    build_snapshot: Callable[[], WorkflowRunSnapshot],
) -> AdmittedRun:
    """Record one admission decision per trigger key, leaving an accepted run queued.

    Retries return the original run with its configuration, inputs and decision.
    """
    if not trigger_key or len(trigger_key) > 256:
        raise ValueError("Trigger keys must contain between 1 and 256 characters")

    runs = SeerWorkflowRun.objects.using(router.db_for_write(SeerWorkflowRun))
    existing = (
        runs.filter(
            organization_id=config.organization_id,
            workflow_config_id=config.id,
            trigger_key=trigger_key,
        )
        .order_by("-date_added", "-id")
        .first()
    )
    if existing is not None:
        lifecycle = SeerWorkflowRunLifecycle(
            run_id=existing.id, organization_id=existing.organization_id
        )
        return AdmittedRun(
            lifecycle=lifecycle,
            created=False,
            rejection=lifecycle.parse_extras(AdmittedRunExtras).admission.reason,
        )

    decided_at = timezone.now()
    admission: AcceptedAdmission | RejectedAdmission = (
        AcceptedAdmission(decided_at=decided_at)
        if has_quota_available(config)
        else RejectedAdmission(reason="quota_exceeded", decided_at=decided_at)
    )
    extras = AdmittedRunExtras(
        snapshot=build_snapshot(),
        admission=admission,
    )
    lifecycle = SeerWorkflowRunLifecycle.create(config, trigger_key=trigger_key, extras=extras)
    # TODO(telkins): Decide whether an automation that stays over quota should keep
    # recording a rejected run for every trigger.
    if admission.status == "rejected":
        lifecycle.reject(
            error=WorkflowRunError(code=admission.reason, message="Automation quota exceeded.")
        )
        return AdmittedRun(lifecycle=lifecycle, created=True, rejection=admission.reason)
    return AdmittedRun(lifecycle=lifecycle, created=True)
