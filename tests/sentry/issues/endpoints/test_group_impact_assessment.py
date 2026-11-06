from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.test import override_settings

from sentry.testutils.cases import APITestCase


@override_settings(SENTRY_SELF_HOSTED=False)
class GroupImpactAssessmentEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.url = (
            f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/impact/assess/"
        )
        self.login_as(self.user)

    @patch("sentry.issues.endpoints.group_impact_assessment.assess_impact_for_group")
    def test_starts_impact_assessment(self, mock_assess: MagicMock) -> None:
        run_uuid = uuid4()
        mock_assess.return_value = SimpleNamespace(uuid=run_uuid)

        with self.feature("organizations:seer-impact-assessment"):
            response = self.client.post(self.url, format="json")

        assert response.status_code == 202, response.content
        assert response.data == {"runId": str(run_uuid)}
        mock_assess.assert_called_once_with(self.group)

    @patch("sentry.issues.impact.assessment.SeerAgentClient")
    def test_requires_feature(self, mock_client: MagicMock) -> None:
        response = self.client.post(self.url, format="json")

        assert response.status_code == 403, response.content
        assert response.data == {
            "detail": "Seer Impact assessment is not enabled for this organization"
        }
        mock_client.assert_not_called()

    def test_requires_event(self) -> None:
        with self.feature("organizations:seer-impact-assessment"):
            response = self.client.post(self.url, format="json")

        assert response.status_code == 400, response.content
        assert response.data == {
            "detail": f"Group {self.group.id} has no event available for Impact assessment"
        }

    @patch("sentry.issues.endpoints.group_impact_assessment.assess_impact_for_group")
    def test_requires_seer_access(self, mock_assess: MagicMock) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        with self.feature("organizations:seer-impact-assessment"):
            response = self.client.post(self.url, format="json")

        assert response.status_code == 403, response.content
        assert response.data == {"detail": "AI features are disabled for this organization."}
        mock_assess.assert_not_called()

    @patch("sentry.issues.endpoints.group_impact_assessment.assess_impact_for_group")
    def test_requires_issue_in_organization(self, mock_assess: MagicMock) -> None:
        other_organization = self.create_organization(owner=self.user)
        url = (
            f"/api/0/organizations/{other_organization.slug}/issues/{self.group.id}/impact/assess/"
        )

        with self.feature("organizations:seer-impact-assessment"):
            response = self.client.post(url, format="json")

        assert response.status_code == 404, response.content
        mock_assess.assert_not_called()
