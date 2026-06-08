from typing import Any
from unittest.mock import MagicMock

from sentry.api.endpoints.organization_events_root_cause_analysis import (
    RootCauseAnalysisQuerySerializer,
)
from sentry.testutils.cases import APITestCase


class RootCauseAnalysisQuerySerializerTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project(organization=self.organization)
        self.access = MagicMock()
        self.access.has_any_project_scope.return_value = True

    def _data(self, project: str) -> dict[str, str]:
        return {
            "transaction": "GET /api/0/issues/",
            "project": project,
            "breakpoint": "2024-01-01T00:00:00Z",
        }

    def _context(self) -> dict[str, Any]:
        return {"access": self.access, "organization": self.organization}

    def test_accepts_project_id(self) -> None:
        serializer = RootCauseAnalysisQuerySerializer(
            data=self._data(str(self.project.id)), context=self._context()
        )

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["project"] == self.project

    def test_accepts_project_slug(self) -> None:
        serializer = RootCauseAnalysisQuerySerializer(
            data=self._data(self.project.slug), context=self._context()
        )

        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["project"] == self.project

    def test_rejects_project_id_from_another_organization(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        serializer = RootCauseAnalysisQuerySerializer(
            data=self._data(str(other_project.id)), context=self._context()
        )

        assert not serializer.is_valid()
        assert str(serializer.errors["project"][0]) == "Invalid project"

    def test_rejects_project_id_without_scope(self) -> None:
        self.access.has_any_project_scope.return_value = False
        serializer = RootCauseAnalysisQuerySerializer(
            data=self._data(str(self.project.id)), context=self._context()
        )

        assert not serializer.is_valid()
        assert str(serializer.errors["project"][0]) == "Insufficient access to project"
