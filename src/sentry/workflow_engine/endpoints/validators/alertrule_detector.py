from rest_framework import serializers


class AlertRuleDetectorValidator(serializers.Serializer):
    rule_id = serializers.CharField(required=False)
    alert_rule_id = serializers.CharField(required=False)
    detector_id = serializers.CharField(required=False)

    def validate(self, attrs):
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
