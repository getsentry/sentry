from rest_framework import serializers


class IncidentGroupOpenPeriodValidator(serializers.Serializer):
    incident_id = serializers.IntegerField(required=False)
    incident_identifier = serializers.IntegerField(required=False)
    group_id = serializers.IntegerField(required=False)
    open_period_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        super().validate(attrs)
        if (
            not attrs.get("incident_id")
            and not attrs.get("incident_identifier")
            and not attrs.get("group_id")
            and not attrs.get("open_period_id")
        ):
            raise serializers.ValidationError(
                "One of 'incident_id', 'incident_identifier', 'group_id', or 'open_period_id' must be provided."
            )
        return attrs
