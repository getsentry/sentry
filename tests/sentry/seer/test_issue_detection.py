from typing import Any
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from sentry.models.project import Project
from sentry.seer.issue_detection import create_issue_occurrence
from sentry.testutils.cases import TestCase


class TestCreateIssueOccurrence(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    @patch("sentry.seer.issue_detection.create_issue_occurrence_from_detection")
    def test_create_issue_occurrence_success(self, mock_create: Any) -> None:
        detected_issue = {
            "explanation": "Test explanation",
            "impact": "Test impact",
            "evidence": "Test evidence",
            "missing_telemetry": None,
            "offender_span_ids": ["span1", "span2"],
            "title": "Test Issue",
            "subcategory": "test",
            "category": "performance",
            "verification_reason": "test reason",
            "trace_id": "abc123",
            "transaction_name": "/api/test",
        }

        result = create_issue_occurrence(
            organization_id=self.organization.id,
            project_id=self.project.id,
            detected_issue=detected_issue,
        )

        assert result == {"success": True}
        mock_create.assert_called_once()
        call_args = mock_create.call_args
        assert call_args.kwargs["project"] == self.project
        assert call_args.kwargs["detected_issue"].title == "Test Issue"

    def test_create_issue_occurrence_invalid_data(self) -> None:
        with pytest.raises(ValidationError):
            create_issue_occurrence(
                organization_id=self.organization.id,
                project_id=self.project.id,
                detected_issue={"invalid": "data"},
            )

    def test_create_issue_occurrence_project_not_in_organization(self) -> None:
        other_project = self.create_project(organization=self.create_organization(owner=self.user))

        detected_issue = {
            "explanation": "Test explanation",
            "impact": "Test impact",
            "evidence": "Test evidence",
            "missing_telemetry": None,
            "offender_span_ids": ["span1", "span2"],
            "title": "Test Issue",
            "subcategory": "test",
            "category": "performance",
            "verification_reason": "test reason",
            "trace_id": "abc123",
            "transaction_name": "/api/test",
        }

        with pytest.raises(Project.DoesNotExist):
            create_issue_occurrence(
                organization_id=self.organization.id,
                project_id=other_project.id,
                detected_issue=detected_issue,
            )

    @patch("sentry.seer.issue_detection.logger")
    @patch("sentry.seer.issue_detection.create_issue_occurrence_from_detection")
    def test_create_issue_occurrence_creation_fails(
        self, mock_create: Any, mock_logger: Any
    ) -> None:
        detected_issue = {
            "explanation": "Test explanation",
            "impact": "Test impact",
            "evidence": "Test evidence",
            "missing_telemetry": None,
            "offender_span_ids": ["span1", "span2"],
            "title": "Test Issue",
            "subcategory": "test",
            "category": "performance",
            "verification_reason": "test reason",
            "trace_id": "abc123",
            "transaction_name": "/api/test",
        }

        mock_create.side_effect = Exception("Failed to create occurrence")

        with pytest.raises(Exception, match="Failed to create occurrence"):
            create_issue_occurrence(
                organization_id=self.organization.id,
                project_id=self.project.id,
                detected_issue=detected_issue,
            )

        mock_logger.info.assert_not_called()
