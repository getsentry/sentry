from collections.abc import Mapping
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.workflow_engine.models import AlertRuleWorkflow


class ActionHandlerSerializerResponse(TypedDict):
    ruleId: str | None
    alertRuleId: str | None
    workflowId: str


@register(AlertRuleWorkflow)
class AlertRuleWorkflowSerializer(Serializer):
    def serialize(
        self, obj: AlertRuleWorkflow, attrs: Mapping[str, Any], user, **kwargs
    ) -> ActionHandlerSerializerResponse:
        return {
            "ruleId": str(obj.rule_id) if obj.rule_id else None,
            "alertRuleId": str(obj.alert_rule_id) if obj.alert_rule_id else None,
            "workflowId": str(obj.workflow.id),
        }
