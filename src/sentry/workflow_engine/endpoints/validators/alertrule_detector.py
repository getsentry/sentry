from typing import Any

from rest_framework import serializers


class AlertRuleDetectorValidator(serializers.Serializer[Any]):
    rule_id = serializers.IntegerField(required=False, min_value=1)
    alert_rule_id = serializers.IntegerField(required=False, min_value=1)
    detector_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        super().validate(attrs)
        if (
            not attrs.get("rule_id")
            and not attrs.get("alert_rule_id")
            and not attrs.get("detector_id")
        ):
            raise serializers.ValidationError(
                "One of 'rule_id', 'alert_rule_id', or 'detector_id' must be provided."
            )
        return attrs
