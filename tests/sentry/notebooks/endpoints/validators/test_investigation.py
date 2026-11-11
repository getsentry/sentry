from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.notebooks.endpoints.validators import (
    InvestigationCreateValidator,
    InvestigationUpdateValidator,
)


def assert_valid(validator: serializers.Serializer[Any]) -> dict[str, Any]:
    assert validator.is_valid(), validator.errors
    return dict(validator.validated_data)


class TestInvestigationCreateValidator:
    def test_accepts_a_title(self) -> None:
        data = assert_valid(InvestigationCreateValidator(data={"title": "Latency spike"}))

        assert data["title"] == "Latency spike"

    def test_requires_a_title(self) -> None:
        validator = InvestigationCreateValidator(data={"projectIds": [1]})

        assert not validator.is_valid()
        assert "title" in validator.errors

    def test_rejects_a_source(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "source": {"type": "manual"}})

        assert not validator.is_valid()
        assert "source" in validator.errors

    def test_rejects_duplicate_project_ids(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "projectIds": [1, 1]})

        assert not validator.is_valid()
        assert "projectIds" in validator.errors

    def test_converts_multi_word_error_keys_to_camel_case(self) -> None:
        validator = InvestigationCreateValidator(data={"title": "T", "projectIds": "nope"})

        assert not validator.is_valid()
        assert "projectIds" in validator.errors
        assert "project_ids" not in validator.errors


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
