from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators import ParameterValuesValidator


def assert_valid(validator: serializers.Serializer[Any]) -> dict[str, Any]:
    assert validator.is_valid(), validator.errors
    return dict(validator.validated_data)


class TestParameterValuesValidator:
    def test_accepts_an_object_of_values(self) -> None:
        data = assert_valid(
            ParameterValuesValidator(data={"investigationVersion": 1, "values": {"env": "prod"}})
        )

        assert data["values"] == {"env": "prod"}

    def test_rejects_a_non_object_values_payload(self) -> None:
        validator = ParameterValuesValidator(data={"investigationVersion": 1, "values": ["prod"]})

        assert not validator.is_valid()
        assert "values" in validator.errors
