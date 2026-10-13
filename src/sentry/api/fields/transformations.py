import re
from typing import Any

from rest_framework import serializers

from sentry import features


class TransformationsField(serializers.DictField):
    child = serializers.ListField(
        child=serializers.CharField(allow_blank=True, trim_whitespace=False)
    )

    def to_internal_value(self, data: Any) -> dict[str, list[str]]:
        if not isinstance(data, dict):
            raise serializers.ValidationError(
                "Expected an object mapping yAxis positions to lists."
            )
        for index, transformations in data.items():
            if not isinstance(index, str) or re.fullmatch(r"0|[1-9][0-9]*", index) is None:
                raise serializers.ValidationError("Invalid transformations index")
            try:
                int(index)
            except ValueError:
                raise serializers.ValidationError("Invalid transformations index")
            if not isinstance(transformations, list) or not all(
                isinstance(transformation, str) for transformation in transformations
            ):
                raise serializers.ValidationError(
                    "Each transformations value must be a list of strings."
                )
        if data and not features.has(
            "organizations:explore-interpolation-and-smoothing",
            self.context["organization"],
            actor=self.context.get("user"),
        ):
            raise serializers.ValidationError(
                "Transformations are not enabled for this organization."
            )
        return data


def validate_transformation_indexes(transformations: dict[str, list[str]], axis_count: int) -> None:
    if any(int(index) >= axis_count for index in transformations):
        raise serializers.ValidationError(
            {"transformations": "transformations index must match a yAxis position"}
        )
