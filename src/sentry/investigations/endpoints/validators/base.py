from __future__ import annotations

from typing import Any

from rest_framework import serializers
from rest_framework.fields import empty
from rest_framework.utils.serializer_helpers import ReturnDict

from sentry.api.serializers.rest_framework.base import (
    _record_key_case_metric,
    camel_to_snake_case,
    convert_dict_key_case,
    snake_to_camel_case,
)


class StrictCamelSnakeValidator(serializers.Serializer[None]):
    """
    Camel-case API fields while preserving keys inside JSON objects.

    Unknown fields are rejected rather than silently dropped, so a typo'd field
    name fails loudly instead of being ignored.
    """

    def __init__(self, instance: Any = None, data: Any = empty, **kwargs: Any) -> None:
        if isinstance(data, dict):
            _record_key_case_metric(type(self).__name__, data)
            converted: dict[str, Any] = {}
            for key, value in data.items():
                converted_key = camel_to_snake_case(key)
                if converted_key in converted:
                    raise serializers.ValidationError(
                        {key: f"{key} collides with {converted_key}; pass only one value."}
                    )
                converted[converted_key] = value
            data = converted
        super().__init__(instance=instance, data=data, **kwargs)

    @property
    def errors(self) -> ReturnDict[Any, Any]:
        # Raise ValidationError with snake_case keys; they are converted here.
        # snake_to_camel_case lowercases its first word, so an already-camelCase
        # key passed through it comes out flattened ("sourceRef" -> "sourceref").
        return convert_dict_key_case(super().errors, snake_to_camel_case)

    def to_internal_value(self, data: Any) -> dict[str, Any]:
        if isinstance(data, dict):
            unknown = sorted(set(data) - set(self.fields))
            if unknown:
                raise serializers.ValidationError({field: "Unknown field." for field in unknown})
        return super().to_internal_value(data)
