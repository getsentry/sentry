from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, TypedDict, cast

from rest_framework import serializers

from sentry.api.serializers import serialize
from sentry.db.models.fields.bounded import I32_MAX, I64_MAX
from sentry.incidents.endpoints.serializers.query_subscription import SnubaQuerySerializer
from sentry.investigations.contracts import (
    ActionPayloadSerializer,
    StrictCharField,
    StrictContractSerializer,
    StrictFloatField,
    StrictIntegerField,
)
from sentry.investigations.services.action_kinds.base import ActionKind
from sentry.snuba.models import SnubaQuery
from sentry.workflow_engine.endpoints.serializers.data_condition_serializer import (
    DataConditionSerializer,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel

UPDATE_DETECTOR_ACTION = "update_detector"


_DETECTOR_TEXT_LIMITS = {"query": 2_000, "aggregate": 500, "environment": 64}


class DetectorChangesSerializer(StrictContractSerializer):
    """The monitor settings an `update_detector` action can read or change."""

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
        """Drop changes we won't apply: text that's over our limits, or a change to a monitor
        with no current aggregate.

        If no changes are left, the request becomes advice.
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


DetectorValue = int | float | str | None

_THRESHOLD_RESULTS: dict[
    Literal["highThreshold", "mediumThreshold", "resolutionThreshold"], DetectorPriorityLevel
] = {
    "highThreshold": DetectorPriorityLevel.HIGH,
    "mediumThreshold": DetectorPriorityLevel.MEDIUM,
    "resolutionThreshold": DetectorPriorityLevel.OK,
}
_DATA_SOURCE_KEYS = ("timeWindowSeconds", "query", "aggregate", "environment")


class DetectorChanges(TypedDict, total=False):
    timeWindowSeconds: int
    highThreshold: float
    mediumThreshold: float
    resolutionThreshold: float
    query: str
    aggregate: str
    environment: str | None


class DataSourceBody(TypedDict):
    id: str
    dataset: str
    query: str
    aggregate: str
    timeWindow: int
    environment: str | None
    eventTypes: list[str]
    queryType: int


class ConditionBody(TypedDict):
    id: str
    type: str
    # Only static monitors get here, and their conditions compare against a number.
    comparison: float
    conditionResult: int


class ConditionGroupBody(TypedDict):
    id: int
    logicType: str
    conditions: list[ConditionBody]


class DetectorUpdate(TypedDict, total=False):
    """The body we send to the detector validator."""

    conditionGroup: ConditionGroupBody
    dataSources: list[DataSourceBody]


@dataclass(frozen=True)
class DetectorState:
    """A metric monitor's query and conditions, serialized the way the detector API returns
    them, so we can read current values and build an update from the same data.
    """

    data_source: DataSourceBody
    condition_group: ConditionGroupBody | None

    @classmethod
    def load(cls, detector: Detector, snuba_query: SnubaQuery) -> DetectorState:
        serialized = serialize(snuba_query, serializer=SnubaQuerySerializer())
        # Without a mode the update keeps the stored one. Some span monitors migrated from
        # transactions store a mode the validator no longer accepts.
        del serialized["extrapolationMode"]
        data_source = cast(DataSourceBody, {**serialized, "queryType": snuba_query.type})
        group = detector.workflow_condition_group
        condition_group = (
            ConditionGroupBody(
                id=group.id,
                logicType=group.logic_type,
                conditions=cast(
                    list[ConditionBody],
                    serialize(
                        list(group.conditions.order_by("id")), serializer=DataConditionSerializer()
                    ),
                ),
            )
            if group is not None
            else None
        )
        return cls(data_source=data_source, condition_group=condition_group)

    def values(self) -> dict[str, DetectorValue]:
        """The monitor's current settings, keyed like Seer's changes. A threshold is left out
        unless exactly one condition sets it.
        """

        values: dict[str, DetectorValue] = {
            "timeWindowSeconds": self.data_source["timeWindow"],
            "query": self.data_source["query"],
            "aggregate": self.data_source["aggregate"],
            "environment": self.data_source["environment"],
        }
        conditions = self.condition_group["conditions"] if self.condition_group else []
        for key, result in _THRESHOLD_RESULTS.items():
            comparisons = [
                condition["comparison"]
                for condition in conditions
                if condition["conditionResult"] == result
            ]
            if len(comparisons) == 1:
                values[key] = comparisons[0]
        return values

    def update(self, changes: DetectorChanges) -> DetectorUpdate:
        """Apply Seer's changes on top of the current settings."""

        update: DetectorUpdate = {}
        thresholds: dict[int, float] = {
            result: changes[key] for key, result in _THRESHOLD_RESULTS.items() if key in changes
        }
        if thresholds:
            # values() has no thresholds without a condition group, so the stale check stops
            # those changes before they get here.
            assert self.condition_group is not None
            # The update deletes conditions we leave out, so send them all.
            update["conditionGroup"] = {
                **self.condition_group,
                "conditions": [
                    {
                        **condition,
                        "comparison": thresholds.get(
                            condition["conditionResult"], condition["comparison"]
                        ),
                    }
                    for condition in self.condition_group["conditions"]
                ],
            }
        if any(key in changes for key in _DATA_SOURCE_KEYS):
            data_source = self.data_source.copy()
            if "timeWindowSeconds" in changes:
                data_source["timeWindow"] = changes["timeWindowSeconds"]
            if "query" in changes:
                data_source["query"] = changes["query"]
            if "aggregate" in changes:
                data_source["aggregate"] = changes["aggregate"]
            if "environment" in changes:
                data_source["environment"] = changes["environment"]
            update["dataSources"] = [data_source]
        return update


class UpdateDetectorKind(ActionKind):
    kind = UPDATE_DETECTOR_ACTION
    payload_serializer = UpdateDetectorActionSerializer
