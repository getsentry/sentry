import re
from collections import defaultdict, deque
from collections.abc import Sequence
from typing import Any

from rest_framework import serializers

MAX_TRANSFORMATION_AXES = 100
MAX_TRANSFORMATIONS_PER_AXIS = 10
MAX_TRANSFORMATION_LENGTH = 1024
MAX_TRANSFORMATION_INDEX_LENGTH = 10


class TransformationsField(serializers.DictField):
    child = serializers.ListField(
        max_length=MAX_TRANSFORMATIONS_PER_AXIS,
        child=serializers.CharField(
            allow_blank=True, trim_whitespace=False, max_length=MAX_TRANSFORMATION_LENGTH
        ),
    )

    def to_internal_value(self, data: Any) -> dict[str, list[str]]:
        if not isinstance(data, dict):
            raise serializers.ValidationError(
                "Expected an object mapping yAxis positions to lists."
            )
        if len(data) > MAX_TRANSFORMATION_AXES:
            raise serializers.ValidationError(
                f"Ensure transformations has no more than {MAX_TRANSFORMATION_AXES} axes."
            )
        for index, transformations in data.items():
            if (
                not isinstance(index, str)
                or len(index) > MAX_TRANSFORMATION_INDEX_LENGTH
                or re.fullmatch(r"0|[1-9][0-9]*", index) is None
            ):
                raise serializers.ValidationError("Invalid transformations index")
            if (
                isinstance(transformations, list)
                and len(transformations) > MAX_TRANSFORMATIONS_PER_AXIS
            ):
                raise serializers.ValidationError(
                    {
                        index: f"Ensure this field has no more than {MAX_TRANSFORMATIONS_PER_AXIS} elements."
                    }
                )
            if not isinstance(transformations, list) or not all(
                isinstance(transformation, str) for transformation in transformations
            ):
                raise serializers.ValidationError(
                    "Each transformations value must be a list of strings."
                )
        return super().to_internal_value(data)


def validate_transformation_indexes(transformations: dict[str, list[str]], axis_count: int) -> None:
    if any(int(index) >= axis_count for index in transformations):
        raise serializers.ValidationError(
            {"transformations": "transformations index must match a yAxis position"}
        )


def remap_transformation_indexes(
    transformations: dict[str, list[str]], previous_axes: Sequence[str], axes: Sequence[str]
) -> dict[str, list[str]]:
    previous_indexes: dict[str, deque[int]] = defaultdict(deque)
    for index, axis in enumerate(previous_axes):
        previous_indexes[axis].append(index)

    remapped = {}
    for index, axis in enumerate(axes):
        matching_indexes = previous_indexes.get(axis)
        if matching_indexes:
            previous_key = str(matching_indexes.popleft())
            if previous_key in transformations:
                remapped[str(index)] = transformations[previous_key]
    return remapped
