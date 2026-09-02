from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators import (
    InvestigationCreateValidator,
    InvestigationUpdateValidator,
)


def assert_valid(validator: serializers.Serializer[Any]) -> dict[str, Any]:
    assert validator.is_valid(), validator.errors
    return dict(validator.validated_data)


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
                    "source": {"type": "metric_open_period", "ref": {"openPeriodId": "1"}},
                }
            )
        )

        assert data["template_key"] == "breached_metric"

    def test_requires_a_source_with_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={"templateKey": "breached_metric", "templateVersion": 1}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_caller_supplied_projects_with_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {"type": "metric_open_period", "ref": {"openPeriodId": "1"}},
                "projectIds": [1],
            }
        )

        assert not validator.is_valid()
        assert "projectIds" in validator.errors

    def test_accepts_an_agentic_manual_source_without_a_template(self) -> None:
        data = assert_valid(
            InvestigationCreateValidator(
                data={
                    "source": {
                        "type": "manual",
                        "prompt": "Investigate checkout latency",
                        "timeRange": {
                            "start": "2025-01-01T00:00:00Z",
                            "end": "2025-01-01T01:00:00Z",
                        },
                        "seed": {"release": "example-release"},
                    }
                }
            )
        )

        assert "template_key" not in data
        assert data["source"]["seed"] == {"release": "example-release"}

    def test_rejects_a_malformed_agentic_source(self) -> None:
        validator = InvestigationCreateValidator(
            data={"title": "T", "source": {"type": "metric_open_period", "ref": {}}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_template_parameters_for_an_agentic_source(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "manual"}, "parameters": {"environment": "prod"}}
        )

        assert not validator.is_valid()
        assert "parameters" in validator.errors

    def test_rejects_the_removed_mode_discriminator(self) -> None:
        validator = InvestigationCreateValidator(
            data={"mode": "agentic", "source": {"type": "manual"}}
        )

        assert not validator.is_valid()
        assert "mode" in validator.errors

    def test_rejects_an_untrusted_breached_metric_snapshot(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "breached_metric", "projectIds": [1]}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_untrusted_top_level_manual_source_fields(self) -> None:
        validator = InvestigationCreateValidator(
            data={
                "source": {
                    "type": "manual",
                    "prompt": "Investigate latency",
                    "snapshot": {"monitor": {"name": "caller supplied"}},
                }
            }
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_an_unordered_manual_time_range(self) -> None:
        validator = InvestigationCreateValidator(
            data={
                "source": {
                    "type": "manual",
                    "timeRange": {
                        "start": "2025-01-01T02:00:00Z",
                        "end": "2025-01-01T01:00:00Z",
                    },
                }
            }
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_non_object_seed_context(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "manual", "seed": ["not", "an", "object"]}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_an_overlong_manual_prompt(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "manual", "prompt": "x" * 20_001}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_a_null_manual_prompt(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "manual", "prompt": None}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_oversized_source_context(self) -> None:
        validator = InvestigationCreateValidator(
            data={"source": {"type": "manual", "seed": {"context": "x" * 200_000}}}
        )

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_duplicate_project_ids(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "projectIds": [1, 1]})

        assert not validator.is_valid()
        assert "projectIds" in validator.errors

    def test_preserves_camel_case_keys_inside_the_source(self) -> None:
        data = assert_valid(
            InvestigationCreateValidator(
                data={
                    "templateKey": "breached_metric",
                    "templateVersion": 1,
                    "source": {
                        "type": "metric_open_period",
                        "ref": {"openPeriodId": "1", "detectorId": "2"},
                    },
                }
            )
        )

        assert data["source"]["ref"] == {"openPeriodId": "1", "detectorId": "2"}


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
