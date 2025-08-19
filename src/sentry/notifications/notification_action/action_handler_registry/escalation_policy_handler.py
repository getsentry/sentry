import logging

from sentry.escalation_policies.logic import trigger_escalation_policy
from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler, WorkflowEventData

logger = logging.getLogger(__name__)


@action_handler_registry.register(Action.Type.ESCALATION_POLICY)
class EscalationPolicyActionHandler(ActionHandler):
    config_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for an escalation policy trigger Action",
        "type": "object",
        "properties": {
            "target_identifier": {
                "type": ["object"],
                "properties": {
                    "value": {"type": ["integer"]},
                    "label": {"type": ["string"]},
                },
                "required": ["value"],
            },
        },
        "required": ["target_identifier"],
        "additionalProperties": False,
    }
    data_schema = {}

    group = ActionHandler.Group.NOTIFICATION

    @staticmethod
    def execute(
        job: WorkflowEventData,
        action: Action,
        detector: Detector,
    ) -> None:
        policy = EscalationPolicy.objects.get(id=action.config["target_identifier"]["value"])
        trigger_escalation_policy(
            policy=policy,
            group=job.group,
        )
