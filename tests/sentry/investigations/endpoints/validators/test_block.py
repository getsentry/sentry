from __future__ import annotations

from typing import Any

import pytest
from rest_framework import serializers

from sentry.investigations.endpoints.validators import (
    BlockCreateValidator,
    BlockOrderValidator,
    BlockUpdateValidator,
    validate_display,
)
from sentry.investigations.models import InvestigationBlockKind


def assert_valid(validator: serializers.Serializer[Any]) -> dict[str, Any]:
    assert validator.is_valid(), validator.errors
    return dict(validator.validated_data)


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

    def test_requires_a_block_field(self) -> None:
        validator = BlockUpdateValidator(data={"investigationVersion": 1, "version": 1})

        assert not validator.is_valid()
        assert "detail" in validator.errors


class TestBlockOrderValidator:
    def test_accepts_block_ids(self) -> None:
        data = assert_valid(
            BlockOrderValidator(data={"investigationVersion": 1, "blockIds": [3, 1, 2]})
        )

        assert data["block_ids"] == [3, 1, 2]

    def test_rejects_non_positive_ids(self) -> None:
        validator = BlockOrderValidator(data={"investigationVersion": 1, "blockIds": [0]})

        assert not validator.is_valid()


class TestBlockDisplayErrorScoping:
    def test_reports_display_failures_under_the_display_field(self) -> None:
        """
        validate_display raises bare-string errors, which DRF would otherwise
        surface under nonFieldErrors when raised from validate().
        """
        validator = BlockCreateValidator(
            data={
                "investigationVersion": 1,
                "kind": "text",
                "display": {"type": "line", "xAxis": "time", "yAxes": ["count()"]},
            }
        )

        assert not validator.is_valid()
        assert "display" in validator.errors
        assert "nonFieldErrors" not in validator.errors

    def test_block_update_requires_the_block_in_context(self) -> None:
        """Without the guard this raised an uncaught KeyError, i.e. a 500."""
        validator = BlockUpdateValidator(
            data={"investigationVersion": 1, "version": 1, "display": {"type": "markdown"}}
        )

        assert not validator.is_valid()
        assert "display" in validator.errors

    @pytest.mark.parametrize("flag", ["stacked", "showLegend", "queryCollapsed"])
    def test_rejects_non_boolean_display_flags(self, flag: str) -> None:
        validator = BlockCreateValidator(
            data={
                "investigationVersion": 1,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "line",
                    "xAxis": "time",
                    "yAxes": ["count()"],
                    flag: "not-a-boolean",
                },
            }
        )

        assert not validator.is_valid()
        assert "display" in validator.errors

    @pytest.mark.parametrize("flag", ["stacked", "showLegend", "queryCollapsed"])
    def test_accepts_boolean_display_flags(self, flag: str) -> None:
        validator = BlockCreateValidator(
            data={
                "investigationVersion": 1,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "line",
                    "xAxis": "time",
                    "yAxes": ["count()"],
                    flag: True,
                },
            }
        )

        assert validator.is_valid(), validator.errors
