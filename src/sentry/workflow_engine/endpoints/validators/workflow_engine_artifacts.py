from datetime import timedelta
from typing import Any

from rest_framework import serializers

MAX_ID = (1 << 63) - 1
STATS_PERIODS = {"1h": timedelta(hours=1), "24h": timedelta(hours=24), "7d": timedelta(days=7)}


class WorkflowEngineArtifactsQueryValidator(serializers.Serializer[Any]):
    """Normalizes `id` to a decimal database ID, or to 32-char hex for events."""

    type = serializers.ChoiceField(choices=["workflow", "detector", "group", "event"])
    id = serializers.CharField()
    projectId = serializers.IntegerField(required=False, min_value=1, max_value=MAX_ID)
    statsPeriod = serializers.ChoiceField(choices=list(STATS_PERIODS), default="24h")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        is_event = attrs["type"] == "event"
        if is_event and "projectId" not in attrs:
            raise serializers.ValidationError({"projectId": "Required for event lookups."})
        if not is_event and "projectId" in attrs:
            raise serializers.ValidationError({"projectId": "Only supported for event lookups."})

        id_field = (
            serializers.UUIDField()
            if is_event
            else serializers.IntegerField(min_value=1, max_value=MAX_ID)
        )
        try:
            item_id = id_field.run_validation(attrs["id"])
        except serializers.ValidationError as error:
            raise serializers.ValidationError({"id": error.detail})
        attrs["id"] = item_id.hex if is_event else str(item_id)
        return attrs
