from __future__ import annotations

from unittest.mock import patch

from sentry.issues.grouptype import WebVitalsGroup
from sentry.issues.producer import PayloadType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationUserIssueEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-issue"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.project = self.create_project(organization=self.organization)

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    @with_feature("organizations:issue-web-vitals-ingest")
    def test_create_web_vitals_issue_success(self):
        data = {
            "transaction": "/test-transaction",
            "projectId": self.project.id,
            "issueType": WebVitalsGroup.slug,
            "score": 75,
            "vital": "lcp",
        }

        with patch(
            "sentry.api.endpoints.organization_user_issue.produce_occurrence_to_kafka"
        ) as mock_produce:
            response = self.get_success_response(
                self.organization.slug,
                status_code=200,
                **data,
            )

        assert response.status_code == 200
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

        # Verify event data
        assert event_data["project_id"] == self.project.id
        assert event_data["platform"] == self.project.platform
        assert "event_id" in event_data
        assert "timestamp" in event_data
        assert "received" in event_data
        assert event_data["tags"] == {
            "transaction": "/test-transaction",
            "web_vital": "lcp",
            "score": 75,
        }

    def test_no_access(self):
        data = {
            "transaction": "/test-transaction",
            "projectId": self.project.id,
            "issueType": WebVitalsGroup.slug,
        }

        response = self.get_error_response(
            self.organization.slug,
            status_code=404,
            **data,
        )

        assert response.status_code == 404

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    @with_feature("organizations:issue-web-vitals-ingest")
    def test_invalid_project_id(self):
        data = {
            "transaction": "/test-transaction",
            "projectId": 99999,
            "issueType": WebVitalsGroup.slug,
            "score": 75,
            "vital": "lcp",
        }

        response = self.get_error_response(
            self.organization.slug,
            status_code=500,
            **data,
        )

        assert response.status_code == 500

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    @with_feature("organizations:issue-web-vitals-ingest")
    def test_missing_required_fields(self):
        data = {
            "transaction": "/test-transaction",
        }

        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
            **data,
        )

        assert response.status_code == 400
        assert "projectId" in response.data
        assert "issueType" in response.data

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    @with_feature("organizations:issue-web-vitals-ingest")
    def test_invalid_web_vitals_fields(self):
        data = {
            "transaction": "/test-transaction",
            "projectId": self.project.id,
            "issueType": WebVitalsGroup.slug,
            "score": 150,
            "vital": "invalid_vital",
        }

        response = self.get_error_response(
            self.organization.slug,
            status_code=400,
            **data,
        )

        assert response.status_code == 400
        assert "score" in response.data or "vital" in response.data

    @with_feature("organizations:performance-web-vitals-seer-suggestions")
    @with_feature("organizations:issue-web-vitals-ingest")
    def test_web_vitals_issue_fingerprint_consistency(self):
        data = {
            "transaction": "/test-transaction",
            "projectId": self.project.id,
            "issueType": WebVitalsGroup.slug,
            "score": 75,
            "vital": "lcp",
        }

        with patch(
            "sentry.api.endpoints.organization_user_issue.produce_occurrence_to_kafka"
        ) as mock_produce:
            response1 = self.get_success_response(
                self.organization.slug,
                status_code=200,
                **data,
            )
            response2 = self.get_success_response(
                self.organization.slug,
                status_code=200,
                **data,
            )

        assert response1.status_code == 200
        assert response2.status_code == 200

        call1_args = mock_produce.call_args_list[0]
        call2_args = mock_produce.call_args_list[1]

        fingerprint1 = call1_args[1]["occurrence"].fingerprint
        fingerprint2 = call2_args[1]["occurrence"].fingerprint

        assert fingerprint1 == fingerprint2
        assert fingerprint1 == ["insights-web-vitals-lcp-/test-transaction"]
