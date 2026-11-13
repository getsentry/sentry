from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Literal, NamedTuple, override

from django.db import router, transaction
from django.db.models import QuerySet
from pydantic import BaseModel, PositiveInt, ValidationError

from sentry import features
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.incidents.grouptype import MetricIssue
from sentry.investigations.services import create_agentic_breached_metric_investigation
from sentry.investigations.services.breached_metrics import resolve_breached_metric_sources
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notebooks.models import Notebook
from sentry.seer.models.workflow import (
    SeerWorkflowConfig,
    SeerWorkflowExecutionExtras,
    SeerWorkflowRun,
    SeerWorkflowRunExecution,
    SeerWorkflowStrategy,
    SeerWorkflowTriggerBinding,
    WorkflowRunError,
)
from sentry.seer.workflows.base import (
    AutomationAction,
    AutomationDefinition,
    AutomationTrigger,
    ConfigUpdate,
    NoSettings,
    RejectionReason,
    ScopeSelection,
    SelectedMonitors,
    WorkflowUpdateError,
    lock_config,
)
from sentry.seer.workflows.runs import SeerWorkflowRunLifecycle
from sentry.seer_workflow_outputs.executions import finish_execution_if_outputs_done
from sentry.seer_workflow_outputs.models import SeerWorkflowOutputLink
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType
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
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, FeatureGate

logger = logging.getLogger(__name__)


class MetricBreachInputs(BaseModel):
    event_id: str
    occurrence_id: str
    detector_id: PositiveInt
    evidence: dict[str, Any]
    observed_at: datetime
    environment: str | None = None
    group_id: int
    group_short_id: str | None = None
    project_id: int
    invocation_source: Literal["wfe"] = "wfe"
    binding_id: int
    workflow_id: int
    action_id: int


class MetricAlertTrigger(AutomationTrigger[MetricBreachInputs]):
    """Runs when a connected metric monitor opens an issue.

    The config's backing alert workflow holds the monitor connections, so the automation
    covers whichever projects those monitors are in.
    """

    inputs_type = MetricBreachInputs
    settings_type = NoSettings
    scoped_by: Literal["projects", "monitors"] = "monitors"

    def projects(self, config: SeerWorkflowConfig) -> QuerySet[Project]:
        projects = Project.objects.filter(
            organization_id=config.organization_id, status=ObjectStatus.ACTIVE
        )
        if config.backing_workflow_id is None:
            return projects.none()
        return projects.filter(
            id__in=DetectorWorkflow.objects.filter(
                workflow_id=config.backing_workflow_id,
                workflow__status=ObjectStatus.ACTIVE,
                detector__status=ObjectStatus.ACTIVE,
            ).values("detector__project_id")
        )

    def set_scope(self, update: ConfigUpdate, selection: ScopeSelection) -> None:
        """Callers must authorize and audit the change."""
        if not isinstance(selection, SelectedMonitors):
            raise WorkflowUpdateError(
                "Breached metric projects are selected by connecting monitors"
            )
        config = update.config
        change = _set_monitor_selection(config.organization_id, config, selection.monitor_ids)
        if change is None:
            return
        update.mark("backing_workflow")
        # Read the version at commit time, after update_config bumps it.
        transaction.on_commit(
            lambda: logger.info(
                "seer.workflow.monitors_updated",
                extra={
                    **asdict(change),
                    "organization_id": config.organization_id,
                    "config_id": config.id,
                    "config_version": config.version,
                    "strategy": config.strategy,
                },
            ),
            using=router.db_for_write(SeerWorkflowConfig),
        )

    def sync(self, config: SeerWorkflowConfig) -> None:
        workflow = (
            Workflow.objects.filter(
                id=config.backing_workflow_id, organization_id=config.organization_id
            )
            .exclude(enabled=config.enabled)
            .first()
        )
        if workflow is not None:
            # Saved through the instance so the processing-workflows cache is invalidated.
            workflow.update(enabled=config.enabled)

    def teardown(self, config: SeerWorkflowConfig) -> None:
        if config.backing_workflow_id is None:
            return
        workflow = Workflow.objects_for_deletion.filter(
            id=config.backing_workflow_id, organization_id=config.organization_id
        ).first()
        if workflow is not None and workflow.status == ObjectStatus.ACTIVE:
            CellScheduledDeletion.schedule(workflow, days=0)
            workflow.update(status=ObjectStatus.PENDING_DELETION)


class InvestigateBreachedMetricAction(AutomationAction[MetricBreachInputs]):
    settings_type = NoSettings

    def dispatch(
        self, config: SeerWorkflowConfig, run: SeerWorkflowRunLifecycle, inputs: MetricBreachInputs
    ) -> None:
        (execution,) = run.create_executions([SeerWorkflowExecutionExtras()])
        run.start_execution(execution.id)
        error = self._start_investigation(config, inputs, execution)
        if error is not None:
            run.complete_execution(execution.id, error=error)
        else:
            finish_execution_if_outputs_done(execution, organization_id=config.organization_id)

    def _start_investigation(
        self,
        config: SeerWorkflowConfig,
        inputs: MetricBreachInputs,
        execution: SeerWorkflowRunExecution,
    ) -> WorkflowRunError | None:
        try:
            with transaction.atomic(router.db_for_write(Notebook)):
                group = Group.objects.select_related("project__organization").get(
                    id=inputs.group_id,
                    project_id=inputs.project_id,
                    project__organization_id=config.organization_id,
                )
                open_period = get_latest_open_period(group)
                if open_period is None:
                    return WorkflowRunError(
                        code="source_unavailable", message="The metric issue has no open period."
                    )
                source_ref = (group.id, open_period.id)
                source = resolve_breached_metric_sources(
                    organization=group.organization,
                    source_refs=[source_ref],
                    accessible_project_ids={group.project_id},
                ).get(source_ref)
                if source is None:
                    return WorkflowRunError(
                        code="source_unavailable", message="Could not resolve the breached metric."
                    )
                if config.service_account_id is None:
                    return WorkflowRunError(
                        code="service_account_unavailable",
                        message="The automation has no service account.",
                    )
                notebook, _ = create_agentic_breached_metric_investigation(
                    organization=group.organization,
                    creator=ActorId(ActorType.SERVICE_ACCOUNT, config.service_account_id),
                    title=None,
                    resolved_source=source,
                    project_ids=[source.project_id],
                    filters={},
                )
                SeerWorkflowOutputLink.objects.get_or_create(execution=execution, notebook=notebook)
        except Exception:
            logger.exception(
                "seer.workflow.investigation_dispatch_failed",
                extra={
                    "organization_id": config.organization_id,
                    "workflow_config_id": config.id,
                    "execution_id": execution.id,
                    "group_id": inputs.group_id,
                },
            )
            return WorkflowRunError(
                code="dispatch_failed", message="Could not start the investigation."
            )
        return None


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
        "config_disabled",
        "configuration_unavailable",
        "out_of_scope",
    ]


@dataclass(frozen=True)
class RejectedMetricBreach:
    run: SeerWorkflowRun
    reason: RejectionReason
    created: bool


@action_handler_registry.register(Action.Type.SEER_WORKFLOW)
class SeerMetricAlertActionHandler(ActionHandler):
    group = ActionHandler.Group.OTHER
    required_features = (FeatureGate("organizations:seer-automations"),)
    config_schema = {"type": "object", "properties": {}, "additionalProperties": False}
    data_schema = {"type": "object", "properties": {}, "additionalProperties": False}

    @classmethod
    @override
    def get_dedup_key(cls, action: Action) -> str:
        return f"{action.type}:{action.id}"

    @staticmethod
    @override
    def execute(invocation: ActionInvocation) -> None:
        event = invocation.event_data.event
        if not isinstance(event, GroupEvent):
            return
        group = invocation.event_data.require_group()
        extra: dict[str, object] = {
            "organization_id": group.project.organization_id,
            "group_id": group.id,
            "event_id": event.event_id,
            "detector_id": invocation.detector.id,
            "workflow_id": invocation.workflow_id,
            "action_id": invocation.action.id,
        }
        binding = SeerWorkflowTriggerBinding.objects.filter(
            workflow_config__organization_id=group.project.organization_id,
            trigger_action=invocation.action,
        ).first()
        if binding is None:
            _record_trigger_outcome("ignored", extra, reason="missing_binding")
            return

        extra.update(workflow_config_id=binding.workflow_config_id, binding_id=binding.id)
        admission = SeerMetricAlertActionHandler.accept(
            group, event, binding=binding, workflow_id=invocation.workflow_id
        )
        outcome: Literal["accepted", "rejected", "ignored"]
        reason: str | None = None
        deduplicated = False
        if isinstance(admission, AcceptedMetricBreach):
            outcome = "accepted"
            deduplicated = not admission.created
            extra.update(run_id=admission.run.id, run_created=admission.created)
        elif isinstance(admission, RejectedMetricBreach):
            outcome = "rejected"
            reason = admission.reason
            deduplicated = not admission.created
            extra.update(run_id=admission.run.id, run_created=admission.created)
        else:
            outcome = "ignored"
            reason = admission.reason
        _record_trigger_outcome(outcome, extra, reason=reason, deduplicated=deduplicated)

    @staticmethod
    def accept(
        group: Group,
        event: GroupEvent,
        *,
        binding: SeerWorkflowTriggerBinding,
        workflow_id: int,
    ) -> AcceptedMetricBreach | RejectedMetricBreach | IgnoredMetricBreach:
        """Check eligibility, then record one admission decision per issue and config."""
        if not features.has("organizations:seer-automations", group.organization):
            return IgnoredMetricBreach("feature_disabled")
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
            inputs = MetricBreachInputs(
                event_id=event.event_id,
                occurrence_id=occurrence.id,
                detector_id=occurrence.evidence_data.get("detector_id"),
                evidence=dict(occurrence.evidence_data),
                observed_at=occurrence.detection_time,
                environment=event.get_tag("environment"),
                group_id=group.id,
                group_short_id=group.qualified_short_id,
                project_id=group.project_id,
                binding_id=binding.id,
                workflow_id=workflow_id,
                action_id=binding.trigger_action_id,
            )
        except ValidationError:
            return IgnoredMetricBreach("invalid_source")

        try:
            with lock_config(group.organization.id, binding.workflow_config_id) as config:
                if not config.enabled:
                    return IgnoredMetricBreach("config_disabled")
                definition = _definition_for(config)
                if definition is None or not isinstance(definition.trigger, MetricAlertTrigger):
                    return IgnoredMetricBreach("configuration_unavailable")
                if not definition.covers(config, group.project_id, inputs.environment):
                    return IgnoredMetricBreach("out_of_scope")

                run = definition.trigger_run(
                    config, trigger_key=f"issue_created:{group.id}", inputs=inputs
                )
                if run.rejection is not None:
                    return RejectedMetricBreach(
                        run=run.lifecycle.get_run(), reason=run.rejection, created=run.created
                    )
                return AcceptedMetricBreach(run=run.lifecycle.get_run(), created=run.created)
        except SeerWorkflowConfig.DoesNotExist:
            return IgnoredMetricBreach("configuration_unavailable")


def _record_trigger_outcome(
    outcome: Literal["accepted", "rejected", "ignored"],
    extra: dict[str, object],
    *,
    reason: str | None = None,
    deduplicated: bool = False,
) -> None:
    metrics.incr(
        "seer.workflow.trigger",
        tags={
            "outcome": outcome,
            "reason": reason or "none",
            "deduplicated": str(deduplicated).lower(),
        },
        sample_rate=1.0,
    )
    logger.info(
        "seer.workflow.trigger",
        extra={**extra, "outcome": outcome, "reason": reason, "deduplicated": deduplicated},
    )


class ConnectedMonitor(NamedTuple):
    monitor_id: int
    project_id: int


@dataclass(frozen=True)
class MonitorSelectionChange:
    workflow_id: int
    workflow_created: bool
    monitor_count: int
    added_count: int
    removed_count: int


def get_config_monitors_bulk(
    configs: Sequence[SeerWorkflowConfig], *, project_filter: Sequence[int] | None = None
) -> dict[int, list[ConnectedMonitor]]:
    """
    Return the active metric monitors connected to each metric automation, sorted by
    monitor ID. With ``project_filter``, only monitors in
    those projects are included.
    """
    config_ids_by_workflow_id = {
        config.backing_workflow_id: config.id
        for config in configs
        if config.strategy == SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION
        and config.backing_workflow_id is not None
    }
    connections = DetectorWorkflow.objects.filter(
        workflow_id__in=config_ids_by_workflow_id,
        workflow__status=ObjectStatus.ACTIVE,
        detector__type=MetricIssue.slug,
        detector__status=ObjectStatus.ACTIVE,
        detector__project__status=ObjectStatus.ACTIVE,
    )
    if project_filter is not None:
        connections = connections.filter(detector__project_id__in=project_filter)

    monitors: defaultdict[int, list[ConnectedMonitor]] = defaultdict(list)
    for workflow_id, detector_id, project_id in connections.order_by("detector_id").values_list(
        "workflow_id", "detector_id", "detector__project_id"
    ):
        config_id = config_ids_by_workflow_id[workflow_id]
        monitors[config_id].append(ConnectedMonitor(detector_id, project_id))

    return dict(monitors)


def get_monitor_project_ids(monitor_ids: Sequence[int], organization: Organization) -> list[int]:
    return list(
        Detector.objects.filter(id__in=monitor_ids, project__organization_id=organization.id)
        .values_list("project_id", flat=True)
        .distinct()
    )


def _set_monitor_selection(
    organization_id: int, config: SeerWorkflowConfig, monitor_ids: Sequence[int]
) -> MonitorSelectionChange | None:
    """
    Creates a backing workflow if one does not exist and sets/replaces its connected monitors.
    Returns the change, or None when nothing changed. Callers must save ``backing_workflow``.
    """
    selected = set(monitor_ids)
    _validate_monitors(organization_id, selected)
    workflow, created = _get_or_create_backing_workflow(organization_id, config)
    existing = set(
        DetectorWorkflow.objects.filter(workflow=workflow).values_list("detector_id", flat=True)
    )
    if not created and existing == selected:
        return None

    if existing != selected:
        _replace_monitor_connections(workflow, existing, selected)
    return MonitorSelectionChange(
        workflow_id=workflow.id,
        workflow_created=created,
        monitor_count=len(selected),
        added_count=len(selected - existing),
        removed_count=len(existing - selected),
    )


def _validate_monitors(organization_id: int, monitor_ids: set[int]) -> None:
    valid_monitor_ids = set(
        Detector.objects.filter(
            id__in=monitor_ids,
            project__organization_id=organization_id,
            project__status=ObjectStatus.ACTIVE,
            type=MetricIssue.slug,
            status=ObjectStatus.ACTIVE,
        ).values_list("id", flat=True)
    )
    if monitor_ids != valid_monitor_ids:
        raise WorkflowUpdateError(
            "Selected monitors must be active metric monitors in this organization."
        )


def _get_or_create_backing_workflow(
    organization_id: int, config: SeerWorkflowConfig
) -> tuple[Workflow, bool]:
    """Replace a missing or deleted backing workflow; returns whether one was created."""
    workflow = (
        Workflow.objects_for_deletion.get(
            id=config.backing_workflow_id, organization_id=organization_id
        )
        if config.backing_workflow_id is not None
        else None
    )
    if workflow is not None and workflow.status == ObjectStatus.ACTIVE:
        return workflow, False
    config.backing_workflow = workflow = _create_backing_workflow(organization_id, config)
    return workflow, True


def _replace_monitor_connections(
    workflow: Workflow, existing: set[int], selected: set[int]
) -> None:
    DetectorWorkflow.objects.filter(workflow=workflow).exclude(detector_id__in=selected).delete()
    DetectorWorkflow.objects.bulk_create(
        [
            DetectorWorkflow(workflow=workflow, detector_id=monitor_id)
            for monitor_id in sorted(selected - existing)
        ]
    )


def _create_backing_workflow(organization_id: int, config: SeerWorkflowConfig) -> Workflow:
    triggers = DataConditionGroup.objects.create(
        organization_id=organization_id,
        logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
    )
    DataCondition.objects.create(
        condition_group=triggers,
        type=Condition.FIRST_SEEN_EVENT,
        comparison=True,
        condition_result=True,
    )
    workflow = Workflow.objects.create(
        organization_id=organization_id,
        name="Seer automation",
        enabled=True,
        config={"frequency": 0},
        when_condition_group=triggers,
    )
    action = Action.objects.create(type=Action.Type.SEER_WORKFLOW, config={}, data={})
    SeerWorkflowTriggerBinding.objects.create(workflow_config=config, trigger_action=action)
    action_group = DataConditionGroup.objects.create(
        organization_id=organization_id, logic_type=DataConditionGroup.Type.ALL
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


def _definition_for(config: SeerWorkflowConfig) -> AutomationDefinition[Any] | None:
    # Imported here because definitions imports this module for its table of pairings.
    from sentry.seer.workflows.definitions import find_definition

    return find_definition(config.strategy)
