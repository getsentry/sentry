from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.investigations.contracts import (
    ActionPayloadSerializer,
    StrictCharField,
    StrictContractSerializer,
    StrictFloatField,
    StrictIntegerField,
)
from sentry.investigations.services.action_kinds.base import ActionKind

UPDATE_DETECTOR_ACTION = "update_detector"


_DETECTOR_TEXT_LIMITS = {"query": 2_000, "aggregate": 500, "environment": 64}


class DetectorChangesSerializer(StrictContractSerializer):
    """The detector settings an `update_detector` action reads or writes."""

    timeWindowSeconds = StrictIntegerField(required=False, min_value=1, max_value=I32_MAX)
    highThreshold = StrictFloatField(required=False)
    mediumThreshold = StrictFloatField(required=False)
    resolutionThreshold = StrictFloatField(required=False)
    query = StrictCharField(
        required=False, allow_blank=True, max_length=_DETECTOR_TEXT_LIMITS["query"]
    )
    aggregate = StrictCharField(required=False, max_length=_DETECTOR_TEXT_LIMITS["aggregate"])
    environment = StrictCharField(
        required=False, allow_null=True, max_length=_DETECTOR_TEXT_LIMITS["environment"]
    )


class UpdateDetectorActionSerializer(ActionPayloadSerializer):
    detectorId = StrictCharField(max_length=32)
    before = DetectorChangesSerializer()
    changes = DetectorChangesSerializer()

    def validate_detectorId(self, value: str) -> str:
        if not (value.isascii() and value.isdigit()) or int(value) > I64_MAX:
            raise serializers.ValidationError("Must be a numeric ID.")
        return value

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        before = attrs["before"]
        changes = attrs["changes"]
        if not changes:
            raise serializers.ValidationError({"changes": "At least one change is required."})
        if set(before) != set(changes):
            raise serializers.ValidationError("before and changes must have the same keys.")
        if any(changes[key] == before[key] for key in changes):
            raise serializers.ValidationError({"changes": "Every change must differ from before."})
        return attrs

    @classmethod
    def trim(cls, action: dict[str, Any]) -> dict[str, Any] | None:
        """Drop changes we won't apply: text over our limits, or a null current aggregate.

        No change left makes the request advice.
        """

        before = action.get("before")
        changes = action.get("changes")
        if (
            not isinstance(before, dict)
            or not isinstance(changes, dict)
            or set(before) != set(changes)
        ):
            return action
        dropped = {
            key
            for key, limit in _DETECTOR_TEXT_LIMITS.items()
            for values in (before, changes)
            if key in values
            and (
                values[key] is None
                if key == "aggregate"
                else isinstance(values[key], str) and len(values[key]) > limit
            )
        }
        if not dropped:
            return action
        kept = [key for key in changes if key not in dropped]
        if not kept:
            return None
        return {
            **action,
            "before": {key: before[key] for key in kept},
            "changes": {key: changes[key] for key in kept},
        }


class UpdateDetectorKind(ActionKind):
    kind = UPDATE_DETECTOR_ACTION
    payload_serializer = UpdateDetectorActionSerializer
