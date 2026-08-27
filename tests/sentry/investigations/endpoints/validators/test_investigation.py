from __future__ import annotations

from typing import Any
from uuid import uuid4

from rest_framework import serializers

from sentry.investigations.endpoints.validators import (
    InvestigationCreateValidator,
    InvestigationOrchestrationCommandValidator,
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

    def test_rejects_a_source_without_a_template(self) -> None:
        validator = InvestigationCreateValidator(
            data={"title": "T", "source": {"type": "metric_open_period", "ref": {}}}
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

    def test_accepts_an_extensible_agentic_source(self) -> None:
        data = assert_valid(
            InvestigationCreateValidator(
                data={
                    "mode": "agentic",
                    "source": {
                        "type": "breached_metric",
                        "projectIds": [1],
                        "seed": {"detector": {"id": "42"}},
                        "futureContext": {"provider": "example"},
                    },
                }
            )
        )

        assert data["mode"] == "agentic"
        assert data["source"]["futureContext"] == {"provider": "example"}

    def test_agentic_creation_rejects_template_fields(self) -> None:
        validator = InvestigationCreateValidator(
            data={
                "mode": "agentic",
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {"type": "manual"},
            }
        )

        assert not validator.is_valid()
        assert "templateKey" in validator.errors


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


class TestFiltersMustBeAnObject:
    """The model types `filters` as dict[str, Any], so non-objects must not pass."""

    def test_create_rejects_a_non_object(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "filters": ["nope"]})

        assert not validator.is_valid()
        assert "filters" in validator.errors

    def test_create_accepts_an_object(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "filters": {"env": "prod"}})

        assert validator.is_valid(), validator.errors

    def test_update_rejects_a_non_object(self) -> None:
        validator = InvestigationUpdateValidator(
            data={"investigationVersion": 1, "filters": "nope"}
        )

        assert not validator.is_valid()
        assert "filters" in validator.errors

    def test_update_accepts_an_object(self) -> None:
        validator = InvestigationUpdateValidator(
            data={"investigationVersion": 1, "filters": {"env": "prod"}}
        )

        assert validator.is_valid(), validator.errors


class TestInvestigationOrchestrationCommandValidator:
    def test_normalizes_a_discriminated_command(self) -> None:
        request_id = uuid4()
        data = assert_valid(
            InvestigationOrchestrationCommandValidator(
                data={
                    "requestId": str(request_id),
                    "expectedWorkflowVersion": 3,
                    "command": {
                        "type": "set_hypothesis_disposition",
                        "hypothesisId": "hypothesis-1",
                        "disposition": None,
                    },
                }
            )
        )

        assert data == {
            "request_id": request_id,
            "expected_workflow_version": 3,
            "command": {
                "type": "set_hypothesis_disposition",
                "hypothesis_id": "hypothesis-1",
                "disposition": None,
            },
        }

    def test_rejects_unknown_nested_fields(self) -> None:
        validator = InvestigationOrchestrationCommandValidator(
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "cancel", "unexpected": True},
            }
        )

        assert not validator.is_valid()
        assert "command" in validator.errors

    def test_provide_input_requires_at_least_one_value(self) -> None:
        validator = InvestigationOrchestrationCommandValidator(
            data={
                "requestId": str(uuid4()),
                "expectedWorkflowVersion": 1,
                "command": {"type": "provide_input"},
            }
        )

        assert not validator.is_valid()
        assert "command" in validator.errors
