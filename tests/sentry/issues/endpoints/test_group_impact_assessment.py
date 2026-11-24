from __future__ import annotations

from unittest.mock import MagicMock, patch

from django.test import override_settings

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunType
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

    def test_starts_impact_assessment(self) -> None:
        event = self.store_event(
            data={"message": "Impact assessment test", "fingerprint": ["impact"]},
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None
        url = f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/impact/assess/"

        with self.feature("organizations:seer-impact-assessment"):
            response = self.client.post(url, format="json")

        assert response.status_code == 202, response.content
        run = SeerRun.objects.get(organization=self.organization, type=SeerRunType.FEATURE_RUN)
        assert response.data == {"runId": str(run.uuid)}
        assert run.user_id == self.user.id

        agent_run = SeerAgentRun.objects.get(run=run)
        assert agent_run.source == IMPACT_FEATURE_ID
        assert agent_run.group_id == group.id
        assert agent_run.project_id == self.project.id

        outbox = CellOutbox.objects.get(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.id
        )
        assert outbox.payload is not None
        body = outbox.payload["body"]
        assert body["feature_id"] == IMPACT_FEATURE_ID
        assert body["payload"]["group_id"] == group.id
        assert body["payload"]["source_event_id"] == event.event_id

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
        assert response.data == {"detail": "Issue has no event available for Impact assessment"}

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
