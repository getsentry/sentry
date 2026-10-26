from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from django.db import router, transaction
from django.utils import timezone
from pydantic import ValidationError

from sentry import features
from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.seer.models.workflow import (
    MetricBreachAdmission,
    MetricBreachExecutionExtras,
    MetricBreachRejectionReason,
    MetricBreachRunExtras,
    MetricBreachTrigger,
    SeerWorkflowConfig,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunStatus,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
    WorkflowRunError,
)
from sentry.seer.workflows.workflow import SeerWorkflow
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


@dataclass(frozen=True)
class RejectedMetricBreach:
    run: SeerWorkflowRun
    reason: MetricBreachRejectionReason
    created: bool


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
        trigger_key = f"issue_created:{group.id}"
        existing = self.get_runs().filter(trigger_key=trigger_key).first()
        if existing is not None:
            if existing.status == SeerWorkflowRunStatus.REJECTED:
                reason = MetricBreachRunExtras.parse_obj(existing.extras).admission.reason
                assert reason is not None
                return RejectedMetricBreach(run=existing, reason=reason, created=False)
            return AcceptedMetricBreach(run=existing, created=False)

        reason = None if self.has_quota_available() else "quota_exceeded"
        admission = MetricBreachAdmission(
            status="rejected" if reason is not None else "accepted",
            reason=reason,
            decided_at=timezone.now(),
        )
        workflow_run, created = self.get_or_create_run(
            trigger_key=trigger_key, inputs=trigger, extras={"admission": admission.dict()}
        )
        if reason is not None:
            workflow_run.reject(
                error=WorkflowRunError(code=reason, message="Automation quota exceeded.")
            )
            return RejectedMetricBreach(run=workflow_run.run, reason=reason, created=created)

        workflow_run.start()
        # TODO(telkins): Replace this no-op execution with investigation dispatch.
        execution = workflow_run.create_execution(extras=MetricBreachExecutionExtras())
        workflow_run.start_execution(execution.id)
        workflow_run.complete_execution(execution.id)
        return AcceptedMetricBreach(run=workflow_run.run, created=created)
