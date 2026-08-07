from __future__ import annotations

from typing import Any

import pytest
from rest_framework import serializers

from sentry.investigations.endpoints.validators import (
    BlockCreateValidator,
    BlockOrderValidator,
    BlockUpdateValidator,
    InvestigationCreateValidator,
    InvestigationUpdateValidator,
    ParameterValuesValidator,
    StrictCamelSnakeValidator,
    validate_display,
)
from sentry.investigations.models import InvestigationBlockKind


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
        """
        Regression guard: subclassing ``CamelSnakeSerializer`` instead would
        convert keys recursively, rewriting ``promptCollapsed`` inside this
        JSONField to ``prompt_collapsed`` and breaking ``validate_display``.
        """
        data = assert_valid(
            _ExampleValidator(data={"nested": {"promptCollapsed": True, "xAxis": "time"}})
        )

        assert data["nested"] == {"promptCollapsed": True, "xAxis": "time"}

    def test_converts_multi_word_error_keys_to_camel_case(self) -> None:
        """
        Regression guard: ``validate()`` must raise with snake_case keys.
        ``snake_to_camel_case`` lowercases its first word, so a hand-written
        camelCase key would be flattened ("sourceRef" -> "sourceref").
        """
        validator = InvestigationCreateValidator(
            data={"templateKey": "breached_metric", "templateVersion": 1}
        )

        assert not validator.is_valid()
        assert "sourceRef" in validator.errors
        assert "sourceref" not in validator.errors

    def test_rejects_colliding_camel_and_snake_keys(self) -> None:
        with pytest.raises(serializers.ValidationError):
            _ExampleValidator(data={"someField": "a", "some_field": "b"})


class TestValidateDisplay:
    def test_accepts_the_bare_markdown_display_for_text_blocks(self) -> None:
        display = {"type": "markdown"}

        assert validate_display(InvestigationBlockKind.TEXT, display) == display

    def test_accepts_a_versioned_markdown_display(self) -> None:
        display = {"version": 1, "type": "markdown", "promptCollapsed": True}

        assert validate_display(InvestigationBlockKind.TEXT, display) == display

    def test_rejects_a_non_boolean_prompt_collapsed(self) -> None:
        with pytest.raises(serializers.ValidationError):
            validate_display(
                InvestigationBlockKind.TEXT,
                {"version": 1, "type": "markdown", "promptCollapsed": "yes"},
            )

    def test_rejects_a_chart_display_on_a_text_block(self) -> None:
        with pytest.raises(serializers.ValidationError):
            validate_display(
                InvestigationBlockKind.TEXT,
                {"version": 1, "type": "line", "xAxis": "time", "yAxes": ["count()"]},
            )

    def test_accepts_the_bare_table_display_for_query_blocks(self) -> None:
        display = {"type": "table"}

        assert validate_display(InvestigationBlockKind.QUERY, display) == display

    def test_accepts_a_legacy_chart_display(self) -> None:
        display = {"type": "line", "xAxis": "time", "yAxes": ["count()"]}

        assert validate_display(InvestigationBlockKind.QUERY, display) == display

    @pytest.mark.parametrize(
        "display",
        [
            {"type": "line", "xAxis": "time"},
            {"type": "line", "xAxis": "", "yAxes": ["count()"]},
            {"type": "line", "xAxis": "time", "yAxes": []},
            {"type": "line", "xAxis": "time", "yAxes": [""]},
            {"type": "pie", "xAxis": "time", "yAxes": ["count()"]},
        ],
    )
    def test_rejects_malformed_legacy_chart_displays(self, display: dict[str, Any]) -> None:
        with pytest.raises(serializers.ValidationError):
            validate_display(InvestigationBlockKind.QUERY, display)

    def test_accepts_a_versioned_query_display(self) -> None:
        display = {
            "version": 1,
            "type": "area",
            "xAxis": "time",
            "yAxes": ["count()"],
            "defaultView": "chart",
            "unit": "duration",
            "sort": "descending",
            "topN": 5,
            "queryCollapsed": True,
        }

        assert validate_display(InvestigationBlockKind.QUERY, display) == display

    @pytest.mark.parametrize(
        "override",
        [
            {"type": "pie"},
            {"defaultView": "graph"},
            {"queryCollapsed": "yes"},
            {"unit": "furlongs"},
            {"sort": "sideways"},
            {"topN": 0},
            {"topN": 21},
            {"unexpectedKey": 1},
            {"version": 2},
        ],
    )
    def test_rejects_malformed_versioned_query_displays(self, override: dict[str, Any]) -> None:
        display = {
            "version": 1,
            "type": "line",
            "xAxis": "time",
            "yAxes": ["count()"],
            **override,
        }

        with pytest.raises(serializers.ValidationError):
            validate_display(InvestigationBlockKind.QUERY, display)

    def test_versioned_table_display_does_not_require_axes(self) -> None:
        display = {"version": 1, "type": "table", "defaultView": "table"}

        assert validate_display(InvestigationBlockKind.QUERY, display) == display


class TestBlockCreateValidator:
    def test_defaults_the_display_for_a_text_block(self) -> None:
        data = assert_valid(BlockCreateValidator(data={"investigationVersion": 1, "kind": "text"}))

        assert data["display"] == {"type": "markdown"}

    def test_defaults_the_display_for_a_query_block(self) -> None:
        data = assert_valid(BlockCreateValidator(data={"investigationVersion": 1, "kind": "query"}))

        assert data["display"] == {"version": 1, "type": "table", "defaultView": "table"}

    def test_rejects_an_unknown_kind(self) -> None:
        validator = BlockCreateValidator(data={"investigationVersion": 1, "kind": "diagram"})

        assert not validator.is_valid()
        assert "kind" in validator.errors

    def test_rejects_a_non_object_display(self) -> None:
        validator = BlockCreateValidator(
            data={"investigationVersion": 1, "kind": "text", "display": "markdown"}
        )

        assert not validator.is_valid()

    def test_rejects_a_non_object_config(self) -> None:
        validator = BlockCreateValidator(
            data={"investigationVersion": 1, "kind": "text", "config": [1, 2]}
        )

        assert not validator.is_valid()

    def test_requires_an_investigation_version(self) -> None:
        validator = BlockCreateValidator(data={"kind": "text"})

        assert not validator.is_valid()
        assert "investigationVersion" in validator.errors


class TestBlockUpdateValidator:
    def test_validates_the_display_against_the_existing_block_kind(self) -> None:
        class FakeBlock:
            kind = InvestigationBlockKind.TEXT

        validator = BlockUpdateValidator(
            data={"investigationVersion": 1, "version": 1, "display": {"type": "markdown"}},
            context={"block": FakeBlock()},
        )

        assert validator.is_valid(), validator.errors

    def test_rejects_a_display_that_does_not_match_the_block_kind(self) -> None:
        class FakeBlock:
            kind = InvestigationBlockKind.TEXT

        validator = BlockUpdateValidator(
            data={
                "investigationVersion": 1,
                "version": 1,
                "display": {"type": "line", "xAxis": "time", "yAxes": ["count()"]},
            },
            context={"block": FakeBlock()},
        )

        assert not validator.is_valid()

    def test_requires_both_versions(self) -> None:
        validator = BlockUpdateValidator(data={"investigationVersion": 1})

        assert not validator.is_valid()
        assert "version" in validator.errors


class TestBlockOrderValidator:
    def test_accepts_block_ids(self) -> None:
        data = assert_valid(
            BlockOrderValidator(data={"investigationVersion": 1, "blockIds": [3, 1, 2]})
        )

        assert data["block_ids"] == [3, 1, 2]

    def test_rejects_non_positive_ids(self) -> None:
        validator = BlockOrderValidator(data={"investigationVersion": 1, "blockIds": [0]})

        assert not validator.is_valid()


class TestInvestigationCreateValidator:
    def test_accepts_a_manual_investigation(self) -> None:
        data = assert_valid(InvestigationCreateValidator(data={"title": "Latency spike"}))

        assert data["title"] == "Latency spike"

    def test_requires_a_title_without_a_template(self) -> None:
        validator = InvestigationCreateValidator(data={"projectIds": [1]})

        assert not validator.is_valid()
        assert "title" in validator.errors

    def test_requires_template_key_and_version_together(self) -> None:
        validator = InvestigationCreateValidator(
            data={"title": "T", "templateKey": "breached_metric"}
        )

        assert not validator.is_valid()
        assert "templateKey" in validator.errors

    def test_accepts_a_template_backed_investigation(self) -> None:
        data = assert_valid(
            InvestigationCreateValidator(
                data={
                    "templateKey": "breached_metric",
                    "templateVersion": 1,
                    "sourceRef": {"openPeriodId": "1"},
                }
            )
        )

        assert data["template_key"] == "breached_metric"

    def test_requires_a_source_ref_with_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={"templateKey": "breached_metric", "templateVersion": 1}
        )

        assert not validator.is_valid()
        assert "sourceRef" in validator.errors

    def test_rejects_caller_supplied_projects_with_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "sourceRef": {"openPeriodId": "1"},
                "projectIds": [1],
            }
        )

        assert not validator.is_valid()
        assert "projectIds" in validator.errors

    def test_rejects_a_source_ref_without_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={"title": "T", "sourceRef": {"openPeriodId": "1"}}
        )

        assert not validator.is_valid()
        assert "sourceRef" in validator.errors

    def test_rejects_duplicate_project_ids(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "projectIds": [1, 1]})

        assert not validator.is_valid()
        assert "projectIds" in validator.errors

    def test_preserves_camel_case_keys_inside_the_source_ref(self) -> None:
        data = assert_valid(
            InvestigationCreateValidator(
                data={
                    "templateKey": "breached_metric",
                    "templateVersion": 1,
                    "sourceRef": {"openPeriodId": "1", "detectorId": "2"},
                }
            )
        )

        assert data["source_ref"] == {"openPeriodId": "1", "detectorId": "2"}


class TestInvestigationUpdateValidator:
    def test_accepts_a_status_change(self) -> None:
        data = assert_valid(
            InvestigationUpdateValidator(data={"investigationVersion": 2, "status": "archived"})
        )

        assert data["status"] == "archived"

    def test_rejects_an_unknown_status(self) -> None:
        validator = InvestigationUpdateValidator(
            data={"investigationVersion": 2, "status": "deleted"}
        )

        assert not validator.is_valid()
        assert "status" in validator.errors

    def test_rejects_duplicate_project_ids(self) -> None:
        validator = InvestigationUpdateValidator(
            data={"investigationVersion": 2, "projectIds": [4, 4]}
        )

        assert not validator.is_valid()
        assert "projectIds" in validator.errors


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
