from typing import Any

from rest_framework import serializers


class AlertRuleWorkflowValidator(serializers.Serializer[Any]):
    rule_id = serializers.IntegerField(required=False, min_value=1)
    alert_rule_id = serializers.IntegerField(required=False, min_value=1)
    workflow_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        super().validate(attrs)
        if (
            not attrs.get("rule_id")
            and not attrs.get("alert_rule_id")
            and not attrs.get("workflow_id")
        ):
            raise serializers.ValidationError(
                "One of 'rule_id', 'alert_rule_id', or 'workflow_id' must be provided."
            )
        return attrs
