from __future__ import annotations

import logging
from typing import Literal, override

from sentry.seer.models.workflow import SeerWorkflowConfig
from sentry.seer.workflows.breached_metrics import (
    AcceptedMetricBreach,
    IgnoredMetricBreach,
    MetricAlertDefinition,
    RejectedMetricBreach,
)
from sentry.seer.workflows.definitions import find_definition
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, ActionInvocation, FeatureGate

logger = logging.getLogger(__name__)


@action_handler_registry.register(Action.Type.SEER_INVESTIGATION)
class SeerInvestigationActionHandler(ActionHandler):
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
        # TODO(telkins): WFE reports an arbitrary workflow when an action is attached to
        # several. If that becomes possible here, store the config id in Action.data.
        config = (
            SeerWorkflowConfig.objects.filter(backing_workflow_id=invocation.workflow_id)
            .values_list("id", "strategy", named=True)
            .get_or_none()
        )
        definition = find_definition(config.strategy) if config is not None else None
        if config is None or not isinstance(definition, MetricAlertDefinition):
            _record_trigger_outcome(IgnoredMetricBreach("configuration_unavailable"), extra)
            return

        extra.update(workflow_config_id=config.id)
        admission = definition.admit_breach(
            group,
            event,
            config_id=config.id,
            action_id=invocation.action.id,
            workflow_id=invocation.workflow_id,
        )
        _record_trigger_outcome(admission, extra)


def _record_trigger_outcome(
    admission: AcceptedMetricBreach | RejectedMetricBreach | IgnoredMetricBreach,
    extra: dict[str, object],
) -> None:
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
