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
