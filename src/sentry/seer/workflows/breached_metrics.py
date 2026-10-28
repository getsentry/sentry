from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal

from django.utils import timezone
from pydantic import BaseModel, Field, PositiveInt, ValidationError

from sentry import features
from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
    WorkflowRunError,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.workflow import SeerWorkflow, SeerWorkflowTransaction
from sentry.services.eventstore.models import GroupEvent


@dataclass(frozen=True)
class AcceptedMetricBreach:
    run: SeerWorkflowRun
    created: bool


@dataclass(frozen=True)
class IgnoredMetricBreach:
    reason: Literal[
        "unsupported_trigger",
        "invalid_source",
        "feature_disabled",
        "configuration_unavailable",
        "out_of_scope",
        "workflow_unavailable",
    ]


MetricBreachRejectionReason = Literal["quota_exceeded"]


@dataclass(frozen=True)
class RejectedMetricBreach:
    run: SeerWorkflowRun
    reason: MetricBreachRejectionReason
    created: bool


class MetricBreachTrigger(BaseModel):
    event_id: str
    occurrence_id: str
    detector_id: PositiveInt
    evidence: dict[str, Any]
    observed_at: datetime
    environment: str | None = None
    group_id: int
    project_id: int
    invocation_source: Literal["wfe"] = "wfe"
    binding_id: int
    workflow_id: int
    action_id: int


class AcceptedMetricBreachAdmission(BaseModel):
    status: Literal["accepted"] = "accepted"
    reason: None = None
    decided_at: datetime


class RejectedMetricBreachAdmission(BaseModel):
    status: Literal["rejected"] = "rejected"
    reason: MetricBreachRejectionReason
    decided_at: datetime


MetricBreachAdmission = Annotated[
    AcceptedMetricBreachAdmission | RejectedMetricBreachAdmission,
    Field(discriminator="status"),
]


class MetricBreachRunExtras(SeerWorkflowRunExtras):
    admission: MetricBreachAdmission


class MetricBreachExecutionExtras(SeerWorkflowExecutionExtras):
    result: Literal["noop"] = "noop"


class BreachedMetricWorkflow(SeerWorkflow):
    @classmethod
    def create(
        cls,
        organization_id: int,
        *,
        enabled: bool = False,
        environments: Sequence[str] = (),
    ) -> BreachedMetricWorkflow:
        """Create an automation whose project coverage comes from connected monitors."""
        # TODO(telkins): Wire automation creation into the API/UI using this method.
        # TODO(telkins): Connect existing default Error Spike monitors when seeding the
        # default automation, and connect new projects' default monitors as they are created.
        config = SeerWorkflowConfig.objects.create(
            organization_id=organization_id,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            enabled=enabled,
            filters=SeerWorkflowFilters(all_projects=True, environments=list(environments)).dict(),
        )
        return cls(config_id=config.id, organization_id=organization_id)

    def accept(
        self,
        group: Group,
        event: GroupEvent,
        *,
        binding: SeerWorkflowTriggerBinding,
        workflow_id: int,
    ) -> AcceptedMetricBreach | RejectedMetricBreach | IgnoredMetricBreach:
        """Check eligibility, then record one admission decision per issue and config."""
        if not features.has("organizations:seer-automations", group.organization):
            return IgnoredMetricBreach("feature_disabled")
        if binding.workflow_config_id != self.config_id:
            return IgnoredMetricBreach("workflow_unavailable")
        if group.organization.id != self.organization_id:
            return IgnoredMetricBreach("configuration_unavailable")
        if group.type != MetricIssue.type_id or not isinstance(event, GroupEvent):
            return IgnoredMetricBreach("unsupported_trigger")
        occurrence = event.occurrence
        if (
            event.group_id != group.id
            or event.project_id != group.project_id
            or occurrence is None
            or occurrence.type != MetricIssue
            or occurrence.project_id != group.project_id
            or occurrence.event_id != event.event_id
        ):
            return IgnoredMetricBreach("invalid_source")
        try:
            trigger = MetricBreachTrigger(
                event_id=event.event_id,
                occurrence_id=occurrence.id,
                detector_id=occurrence.evidence_data.get("detector_id"),
                evidence=dict(occurrence.evidence_data),
                observed_at=occurrence.detection_time,
                environment=event.get_tag("environment"),
                group_id=group.id,
                project_id=group.project_id,
                binding_id=binding.id,
                workflow_id=workflow_id,
                action_id=binding.trigger_action_id,
            )
        except ValidationError:
            return IgnoredMetricBreach("invalid_source")

        try:
            with self.transaction() as transaction:
                config = transaction.config
                if (
                    config.strategy != SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
                    or not config.enabled
                ):
                    return IgnoredMetricBreach("configuration_unavailable")
                if not transaction.matches_scope(group.project_id, trigger.environment):
                    return IgnoredMetricBreach("out_of_scope")
                return self._record_run(transaction, group, trigger)
        except SeerWorkflowConfig.DoesNotExist:
            return IgnoredMetricBreach("configuration_unavailable")

    def _record_run(
        self,
        transaction: SeerWorkflowTransaction,
        group: Group,
        trigger: MetricBreachTrigger,
    ) -> AcceptedMetricBreach | RejectedMetricBreach:
        trigger_key = f"issue_created:{group.id}"
        existing = transaction.get_runs().filter(trigger_key=trigger_key).first()
        if existing is not None:
            lifecycle = SeerWorkflowRunLifecycle(
                run_id=existing.id, organization_id=existing.organization_id
            )
            admission = lifecycle.parse_extras(MetricBreachRunExtras).admission
            if admission.status == "rejected":
                return RejectedMetricBreach(run=existing, reason=admission.reason, created=False)
            return AcceptedMetricBreach(run=existing, created=False)

        decided_at = timezone.now()
        admission = (
            AcceptedMetricBreachAdmission(decided_at=decided_at)
            if self.has_quota_available()
            else RejectedMetricBreachAdmission(reason="quota_exceeded", decided_at=decided_at)
        )
        result = transaction.get_or_create_run(
            trigger_key=trigger_key, inputs=trigger, extras={"admission": admission.dict()}
        )
        workflow_run = result.lifecycle
        if admission.status == "rejected":
            run = workflow_run.reject(
                error=WorkflowRunError(code=admission.reason, message="Automation quota exceeded.")
            )
            return RejectedMetricBreach(run=run, reason=admission.reason, created=result.created)

        workflow_run.start()
        # TODO(telkins): Replace this no-op execution with investigation dispatch.
        (execution,) = workflow_run.create_executions([MetricBreachExecutionExtras()])
        workflow_run.start_execution(execution.id)
        workflow_run.complete_execution(execution.id)
        return AcceptedMetricBreach(run=workflow_run.get_run(), created=result.created)
