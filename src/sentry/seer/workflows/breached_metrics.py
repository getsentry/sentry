from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from django.db import router, transaction
from django.utils import timezone
from pydantic import BaseModel, PositiveInt, ValidationError

from sentry import features
from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
)
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import json


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


class MetricBreachAdmission(BaseModel):
    status: Literal["accepted", "rejected"]
    reason: MetricBreachRejectionReason | None
    decided_at: datetime


class MetricBreachRunExtras(BaseModel):
    status: Literal["complete", "rejected"]
    config_version: int
    admission: MetricBreachAdmission
    trigger: MetricBreachTrigger


class MetricBreachExecutionExtras(BaseModel):
    status: Literal["complete"] = "complete"
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
        return cls(config)

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
        if binding.workflow_config_id != self.config.id:
            return IgnoredMetricBreach("workflow_unavailable")
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
            return self._record_run(group, trigger)

    def _record_run(
        self,
        group: Group,
        trigger: MetricBreachTrigger,
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
            reason: MetricBreachRejectionReason | None = (
                None if self.has_quota_available() else "quota_exceeded"
            )
            decided_at = timezone.now()
            extras = MetricBreachRunExtras(
                status="rejected" if reason is not None else "complete",
                config_version=config.version,
                admission=MetricBreachAdmission(
                    status="rejected" if reason is not None else "accepted",
                    reason=reason,
                    decided_at=decided_at,
                ),
                trigger=trigger,
            )
            run = SeerWorkflowRun.objects.create(
                organization_id=group.organization.id,
                workflow_config=config,
                trigger_key=trigger_key,
                date_completed=decided_at,
                extras=json.loads(extras.json()),
            )
            if reason is not None:
                return RejectedMetricBreach(run=run, reason=reason, created=True)
            # TODO(telkins): Replace this no-op execution with investigation dispatch.
            SeerWorkflowRunExecution.objects.create(
                run=run, extras=MetricBreachExecutionExtras().dict()
            )
        return AcceptedMetricBreach(run=run, created=created)
