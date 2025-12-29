from __future__ import annotations

from unittest.mock import patch

from django.urls import reverse

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.producer import PayloadType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectUserIssueEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-user-issue"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="user@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(self.user)

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    def test_create_web_vitals_issue_success(self) -> None:
        data = {
            "transaction": "/test-transaction",
            "issueType": WebVitalsGroup.slug,
            "score": 75,
            "value": 1000,
            "vital": "lcp",
            "traceId": "1234567890",
            "timestamp": "2025-01-01T00:00:00Z",
        }

        with patch(
            "sentry.issues.endpoints.project_user_issue.produce_occurrence_to_kafka"
        ) as mock_produce:
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
                **data,
            )

        assert response.status_code == 200
        assert response.data == {"event_id": mock_produce.call_args[1]["occurrence"].event_id}
        mock_produce.assert_called_once()

        call_args = mock_produce.call_args

        occurrence = call_args[1]["occurrence"]
        event_data = call_args[1]["event_data"]

        assert call_args[1]["payload_type"] == PayloadType.OCCURRENCE
        assert occurrence.type == WebVitalsGroup
        assert occurrence.issue_title == "LCP score needs improvement"
        assert occurrence.subtitle == "/test-transaction has an LCP score of 75"
        assert occurrence.culprit == "/test-transaction"
        assert occurrence.level == "info"
        assert occurrence.evidence_data == {
            "transaction": "/test-transaction",
            "vital": "lcp",
            "score": 75,
            "trace_id": "1234567890",
            "lcp": 1000,
        }

        # Verify event data
        assert event_data["project_id"] == self.project.id
        assert event_data["platform"] == self.project.platform
        assert event_data["timestamp"] == "2025-01-01T00:00:00+00:00"
        assert "event_id" in event_data
        assert "received" in event_data
        assert event_data["tags"] == {
            "transaction": "/test-transaction",
            "web_vital": "lcp",
            "score": "75",
            "lcp": "1000",
        }
        assert event_data["contexts"] == {
            "trace": {
                "trace_id": "1234567890",
                "type": "trace",
            }
        }

    def test_no_access(self) -> None:
        data = {
            "transaction": "/test-transaction",
            "issueType": WebVitalsGroup.slug,
        }

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=404,
            **data,
        )

        assert response.status_code == 404

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    def test_missing_required_fields(self) -> None:
        data = {
            "transaction": "/test-transaction",
        }

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=400,
            **data,
        )

        assert response.status_code == 400
        assert "issueType" in response.data

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    def test_invalid_web_vitals_fields(self) -> None:
        data = {
            "transaction": "/test-transaction",
            "issueType": WebVitalsGroup.slug,
            "score": 150,
            "vital": "invalid_vital",
            "value": 1000,
        }

        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=400,
            **data,
        )

        assert response.status_code == 400
        assert "score" in response.data or "vital" in response.data

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    def test_web_vitals_issue_fingerprint_uniqueness(self) -> None:
        data = {
            "transaction": "/test-transaction",
            "issueType": WebVitalsGroup.slug,
            "score": 75,
            "vital": "lcp",
            "value": 1000,
        }

        with patch(
            "sentry.issues.endpoints.project_user_issue.produce_occurrence_to_kafka"
        ) as mock_produce:
            response1 = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
                **data,
            )
            response2 = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                status_code=200,
                **data,
            )

        assert response1.status_code == 200
        assert response2.status_code == 200

        call1_args = mock_produce.call_args_list[0]
        call2_args = mock_produce.call_args_list[1]

        fingerprint1 = call1_args[1]["occurrence"].fingerprint
        fingerprint2 = call2_args[1]["occurrence"].fingerprint

        assert len(fingerprint1) == 1
        assert len(fingerprint2) == 1
        assert fingerprint1[0].startswith("insights-web-vitals-lcp-/test-transaction-")
        assert fingerprint2[0].startswith("insights-web-vitals-lcp-/test-transaction-")
        assert fingerprint1 != fingerprint2
