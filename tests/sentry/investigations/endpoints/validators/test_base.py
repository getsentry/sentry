from __future__ import annotations

from typing import Any

import pytest
from rest_framework import serializers

from sentry.investigations.endpoints.validators import (
    InvestigationCreateValidator,
    StrictCamelSnakeValidator,
    VisualizationSuggestionValidator,
)


class _ExampleValidator(StrictCamelSnakeValidator):
    some_field = serializers.CharField(required=False)
    nested = serializers.JSONField(required=False)


def assert_valid(validator: serializers.Serializer[Any]) -> dict[str, Any]:
    assert validator.is_valid(), validator.errors
    return dict(validator.validated_data)


class TestStrictCamelSnakeValidator:
    def test_accepts_camel_case_field_names(self) -> None:
        data = assert_valid(_ExampleValidator(data={"someField": "value"}))

        assert data == {"some_field": "value"}

    def test_rejects_unknown_fields_rather_than_dropping_them(self) -> None:
        validator = _ExampleValidator(data={"someField": "v", "typoField": "x"})

        assert not validator.is_valid()
        assert "typoField" in validator.errors

    def test_reports_errors_in_camel_case(self) -> None:
        validator = _ExampleValidator(data={"someField": 1, "nested": object()})

        assert not validator.is_valid()
        assert "nested" in validator.errors

    def test_preserves_camel_case_keys_inside_json_payloads(self) -> None:
        data = assert_valid(
            _ExampleValidator(data={"nested": {"promptCollapsed": True, "xAxis": "time"}})
        )

        assert data["nested"] == {"promptCollapsed": True, "xAxis": "time"}

    def test_converts_multi_word_error_keys_to_camel_case(self) -> None:
        validator = InvestigationCreateValidator(data={"templateKey": "breached_metric"})

        assert not validator.is_valid()
        assert "templateKey" in validator.errors
        assert "templatekey" not in validator.errors

    def test_rejects_colliding_camel_and_snake_keys(self) -> None:
        with pytest.raises(serializers.ValidationError):
            _ExampleValidator(data={"someField": "a", "some_field": "b"})

    def test_leaves_nested_error_keys_untouched(self) -> None:
        validator = VisualizationSuggestionValidator(
            data={
                "currentResult": {"schemaVersion": 99, "tableMarkdown": "x"},
                "visualization": {"type": "line"},
                "requestedChange": "make it a bar chart",
                "currentIntent": "show errors",
            }
        )

        assert not validator.is_valid()
        assert "currentResult" in validator.errors
        assert "schemaVersion" in validator.errors["currentResult"]
        assert "schemaversion" not in validator.errors["currentResult"]
