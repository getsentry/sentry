from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from django.db import router, transaction
from django.utils import timezone
from pydantic import BaseModel, PositiveInt, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroupAction,
    DetectorGroup,
    DetectorWorkflow,
    Workflow,
)


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


type MetricBreachRejectionReason = Literal["quota_exceeded"]


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


@dataclass(frozen=True)
class MetricBreachWorkflowOrigin:
    workflow_id: int
    action_id: int


class BreachedMetricWorkflow(SeerWorkflow):
    def accept(
        self,
        group: Group,
        event: GroupEvent,
        *,
        origin: MetricBreachWorkflowOrigin,
    ) -> AcceptedMetricBreach | RejectedMetricBreach | IgnoredMetricBreach:
        """Check eligibility, then record one admission decision per issue and config."""
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
        if not features.has("organizations:seer-automations", group.organization):
            return IgnoredMetricBreach("feature_disabled")
        try:
            trigger = MetricBreachTrigger(
                event_id=event.event_id,
                occurrence_id=occurrence.id,
                detector_id=occurrence.evidence_data.get("detector_id"),
                evidence=dict(occurrence.evidence_data),
                observed_at=occurrence.detection_time,
                environment=event.get_tag("environment"),
            )
        except ValidationError:
            return IgnoredMetricBreach("invalid_source")
        if not _source_is_valid(group, trigger.detector_id):
            return IgnoredMetricBreach("invalid_source")

        with transaction.atomic(using=router.db_for_write(SeerWorkflowRun)):
            config = (
                SeerWorkflowConfig.objects.select_for_update()
                .filter(
                    id=self.config.id,
                    organization_id=group.organization.id,
                    strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
                    enabled=True,
                )
                .first()
            )
            if config is None:
                return IgnoredMetricBreach("configuration_unavailable")
            self.config = config
            if not self.matches_scope(group.project_id, trigger.environment):
                return IgnoredMetricBreach("out_of_scope")
            binding = SeerWorkflowTriggerBinding.objects.filter(
                workflow_config=config,
                trigger_action_id=origin.action_id,
                trigger_action__type=Action.Type.SEER_WORKFLOW,
                trigger_action__status=ObjectStatus.ACTIVE,
            ).first()
            if binding is None or not _workflow_is_valid(
                group, trigger.detector_id, origin.workflow_id, origin.action_id
            ):
                return IgnoredMetricBreach("workflow_unavailable")
            return self._record_run(group, trigger, origin, binding)

    def _record_run(
        self,
        group: Group,
        trigger: MetricBreachTrigger,
        origin: MetricBreachWorkflowOrigin,
        binding: SeerWorkflowTriggerBinding,
    ) -> AcceptedMetricBreach | RejectedMetricBreach:
        config = self.config
        trigger_key = f"issue_created:{group.id}"
        run = SeerWorkflowRun.objects.filter(
            organization_id=group.organization.id,
            workflow_config=config,
            trigger_key=trigger_key,
        ).first()
        if run is not None and run.extras.get("status") == "rejected":
            return RejectedMetricBreach(
                run=run,
                reason=run.extras["admission"]["reason"],
                created=False,
            )
        created = run is None
        if run is None:
            reason = self.admission_rejection_reason()
            decided_at = timezone.now()
            run = SeerWorkflowRun.objects.create(
                organization_id=group.organization.id,
                workflow_config=config,
                trigger_key=trigger_key,
                date_completed=decided_at,
                extras={
                    "status": "rejected" if reason is not None else "complete",
                    "config_version": config.version,
                    "admission": {
                        "status": "rejected" if reason is not None else "accepted",
                        "reason": reason,
                        "decided_at": decided_at.isoformat(),
                    },
                    "trigger": {
                        **trigger.dict(),
                        "observed_at": trigger.observed_at.isoformat(),
                        "group_id": group.id,
                        "project_id": group.project_id,
                        "invocation_source": "wfe",
                        "binding_id": binding.id,
                        "workflow_id": origin.workflow_id,
                        "action_id": origin.action_id,
                    },
                },
            )
            if reason is not None:
                return RejectedMetricBreach(run=run, reason=reason, created=True)
            # Investigation dispatch will replace this explicit no-op execution.
            SeerWorkflowRunExecution.objects.create(
                run=run, extras={"status": "complete", "result": "noop"}
            )
        return AcceptedMetricBreach(run=run, created=created)


def _source_is_valid(group: Group, detector_id: int) -> bool:
    return DetectorGroup.objects.filter(
        group=group,
        detector_id=detector_id,
        detector__type=MetricIssue.slug,
        detector__project_id=group.project_id,
        detector__status=ObjectStatus.ACTIVE,
    ).exists()


def _workflow_is_valid(group: Group, detector_id: int, workflow_id: int, action_id: int) -> bool:
    return (
        Workflow.objects.filter(
            id=workflow_id,
            organization_id=group.organization.id,
            enabled=True,
            status=ObjectStatus.ACTIVE,
        ).exists()
        and DetectorWorkflow.objects.filter(
            detector_id=detector_id, workflow_id=workflow_id
        ).exists()
        and DataConditionGroupAction.objects.filter(
            action_id=action_id,
            action__type=Action.Type.SEER_WORKFLOW,
            action__status=ObjectStatus.ACTIVE,
            condition_group__workflowdataconditiongroup__workflow_id=workflow_id,
        ).exists()
    )
