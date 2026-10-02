from typing import Any

from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.preview import UnsupportedPreviewBehavior
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import WorkflowEventData, WorkflowTriggerDataConditionHandler


@condition_handler_registry.register(Condition.EVERY_EVENT)
class EveryEventConditionHandler(WorkflowTriggerDataConditionHandler):
    preview_behavior = UnsupportedPreviewBehavior("Every-event previews require event data")
    comparison_json_schema = {"type": "boolean"}
    label_template = "The event occurs"

    @staticmethod
    def evaluate_value(event_data: WorkflowEventData, comparison: Any) -> bool:
        return True
