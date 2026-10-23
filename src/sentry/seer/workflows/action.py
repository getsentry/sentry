import logging
from typing import Literal, override

from sentry.seer.models.workflow import SeerWorkflowTriggerBinding
from sentry.seer.workflows.breached_metrics import (
    AcceptedMetricBreach,
    BreachedMetricWorkflow,
    RejectedMetricBreach,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, FeatureGate

logger = logging.getLogger(__name__)


@action_handler_registry.register(Action.Type.SEER_WORKFLOW)
class SeerWorkflowActionHandler(ActionHandler):
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
        state = invocation.event_data.group_state
        if not isinstance(event, GroupEvent) or state is None or not state["is_new"]:
            return
        group = invocation.event_data.group
        extra: dict[str, object] = {
            "organization_id": group.project.organization_id,
            "group_id": group.id,
            "event_id": event.event_id,
            "detector_id": invocation.detector.id,
            "workflow_id": invocation.workflow_id,
            "action_id": invocation.action.id,
        }
        binding = (
            SeerWorkflowTriggerBinding.objects.filter(
                workflow_config__organization_id=group.project.organization_id,
                trigger_action=invocation.action,
            )
            .select_related("workflow_config")
            .first()
        )
        if binding is None:
            _record_trigger_outcome("ignored", extra, reason="missing_binding")
            return

        extra.update(workflow_config_id=binding.workflow_config_id, binding_id=binding.id)
        admission = BreachedMetricWorkflow(binding.workflow_config).accept(
            group,
            event,
            binding=binding,
            workflow_id=invocation.workflow_id,
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
