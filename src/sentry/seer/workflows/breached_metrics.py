from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal

from django.db import router, transaction
from django.utils import timezone
from pydantic import BaseModel, Field, PositiveInt, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.grouptype import MetricIssue
from sentry.models.group import Group
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowConfigProject,
    SeerWorkflowExecutionExtras,
    SeerWorkflowFilters,
    SeerWorkflowRun,
    SeerWorkflowRunExtras,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
    WorkflowRunError,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer.workflows.workflow import SeerWorkflow, matches_workflow_scope
from sentry.services.eventstore.models import GroupEvent
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)
from sentry.workflow_engine.models.data_condition import Condition


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

    def set_monitor_selection(self, monitor_ids: Sequence[int]) -> None:
        """Replace existing monitor connections, creating the backing workflow on first use.

        The caller is responsible for authorization and auditing. This method
        validates organization/type boundaries and updates the graph atomically
        under the config lock. An empty selection disconnects all monitors.
        """
        with self._lock_config() as config:
            if config.strategy != SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION:
                raise ValueError("Only metric automations support monitor selection.")

            selected = set(monitor_ids)
            eligible = set(
                Detector.objects.filter(
                    id__in=selected,
                    project__organization_id=self.organization_id,
                    project__status=ObjectStatus.ACTIVE,
                    type=MetricIssue.slug,
                    status=ObjectStatus.ACTIVE,
                ).values_list("id", flat=True)
            )
            if selected != eligible:
                raise ValueError(
                    "Selected monitors must be active metric monitors in this organization."
                )

            workflows = list(
                Workflow.objects.filter(
                    organization_id=self.organization_id,
                    workflowdataconditiongroup__condition_group__dataconditiongroupaction__action__seer_workflow_binding__workflow_config=config,
                ).distinct()
            )
            connections = list(
                DetectorWorkflow.objects.filter(workflow__in=workflows).values_list(
                    "workflow_id", "detector_id"
                )
            )
            existing = {detector_id for _, detector_id in connections}
            connected_workflow_ids = {workflow_id for workflow_id, _ in connections}
            # Retired routes may still have bindings. Leave disabled, disconnected
            # workflows alone when there is another backing workflow in use.
            candidates = [
                workflow
                for workflow in workflows
                if workflow.enabled or workflow.id in connected_workflow_ids
            ] or workflows

            workflow: Workflow | None
            if not candidates:
                workflow = self._create_monitor_workflow(config)
            elif existing != selected:
                if len(candidates) != 1:
                    raise ValueError(
                        "Changing monitor selection requires a single backing workflow in use."
                    )
                workflow = candidates[0]
                if (
                    Action.objects.filter(
                        dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow=workflow
                    )
                    .exclude(seer_workflow_binding__workflow_config=config)
                    .exists()
                ):
                    raise ValueError(
                        "The backing workflow must contain only this automation's actions."
                    )
            else:
                workflow = None

            if workflow is not None:
                DetectorWorkflow.objects.filter(workflow=workflow).exclude(
                    detector_id__in=selected
                ).delete()
                DetectorWorkflow.objects.bulk_create(
                    [
                        DetectorWorkflow(workflow=workflow, detector_id=monitor_id)
                        for monitor_id in sorted(selected - existing)
                    ]
                )

            scope_changed = not config.filters.get("all_projects")
            if scope_changed:
                config.filters = {**config.filters, "all_projects": True}
                SeerWorkflowConfigProject.objects.filter(config=config).delete()
            if existing != selected or scope_changed:
                config.version += 1
                config.save(update_fields=["filters", "version", "date_updated"])

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

        return self._record_run(group, trigger)

    def _record_run(
        self,
        group: Group,
        trigger: MetricBreachTrigger,
    ) -> AcceptedMetricBreach | RejectedMetricBreach | IgnoredMetricBreach:
        database = router.db_for_write(SeerWorkflowConfig)
        with transaction.atomic(database):
            config = (
                SeerWorkflowConfig.objects.using(database)
                .select_for_update()
                .filter(
                    id=self.config_id,
                    organization_id=self.organization_id,
                    strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
                    enabled=True,
                )
                .first()
            )
            if config is None:
                return IgnoredMetricBreach("configuration_unavailable")
            if not matches_workflow_scope(config, group.project_id, trigger.environment):
                return IgnoredMetricBreach("out_of_scope")

            trigger_key = f"issue_created:{group.id}"
            existing = self.get_runs().filter(trigger_key=trigger_key).first()
            if existing is not None:
                lifecycle = SeerWorkflowRunLifecycle(
                    run_id=existing.id, organization_id=existing.organization_id
                )
                admission = lifecycle.parse_extras(MetricBreachRunExtras).admission
                if admission.status == "rejected":
                    return RejectedMetricBreach(
                        run=existing, reason=admission.reason, created=False
                    )
                return AcceptedMetricBreach(run=existing, created=False)

            decided_at = timezone.now()
            admission = (
                AcceptedMetricBreachAdmission(decided_at=decided_at)
                if self.has_quota_available()
                else RejectedMetricBreachAdmission(reason="quota_exceeded", decided_at=decided_at)
            )
            result = self.get_or_create_run(
                trigger_key=trigger_key, inputs=trigger, extras={"admission": admission.dict()}
            )
            workflow_run = result.lifecycle
            if admission.status == "rejected":
                run = workflow_run.reject(
                    error=WorkflowRunError(
                        code=admission.reason, message="Automation quota exceeded."
                    )
                )
                return RejectedMetricBreach(
                    run=run, reason=admission.reason, created=result.created
                )

            workflow_run.start()
            # TODO(telkins): Replace this no-op execution with investigation dispatch.
            (execution,) = workflow_run.create_executions([MetricBreachExecutionExtras()])
            workflow_run.start_execution(execution.id)
            workflow_run.complete_execution(execution.id)
            return AcceptedMetricBreach(run=workflow_run.get_run(), created=result.created)

    def _create_monitor_workflow(self, config: SeerWorkflowConfig) -> Workflow:
        triggers = DataConditionGroup.objects.create(
            organization_id=self.organization_id,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        DataCondition.objects.create(
            condition_group=triggers,
            type=Condition.FIRST_SEEN_EVENT,
            comparison=True,
            condition_result=True,
        )
        workflow = Workflow.objects.create(
            organization_id=self.organization_id,
            name=f"Seer metric automation {config.id}",
            enabled=True,
            config={},
            when_condition_group=triggers,
        )
        action = Action.objects.create(type=Action.Type.SEER_WORKFLOW, config={}, data={})
        SeerWorkflowTriggerBinding.objects.create(workflow_config=config, trigger_action=action)
        action_group = DataConditionGroup.objects.create(
            organization_id=self.organization_id, logic_type=DataConditionGroup.Type.ALL
        )
        DataCondition.objects.create(
            condition_group=action_group,
            type=Condition.ISSUE_TYPE,
            comparison={"value": MetricIssue.slug},
            condition_result=True,
        )
        WorkflowDataConditionGroup.objects.create(workflow=workflow, condition_group=action_group)
        DataConditionGroupAction.objects.create(condition_group=action_group, action=action)
        return workflow
