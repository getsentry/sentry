import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import orjson
from rest_framework import status

from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class TestOrganizationSeerAgentUpdate(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        # the agent requires open team membership
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_successful(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"run_id": 123}

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data == {"run_id": 123}

        # Verify the request was made to Seer
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        assert call_args[0][1] == "/v1/automation/explorer/update"

        # Verify the payload
        sent_data = orjson.loads(call_args[0][2])
        assert sent_data["run_id"] == 123
        assert sent_data["organization_id"] == self.organization.id
        assert sent_data["payload"]["type"] == "interrupt"

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_with_uuid_run_id(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        """UUID run_id should be resolved to the numeric seer_run_state_id before forwarding to Seer."""
        mock_has_access.return_value = (True, None)
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"run_id": 456}

        run_uuid = uuid.uuid4()
        SeerRun.objects.create(
            organization=self.organization,
            uuid=run_uuid,
            seer_run_state_id=456,
            type=SeerRunType.EXPLORER,
            mirror_status=SeerRunMirrorStatus.LIVE,
            last_triggered_at=datetime.now(tz=timezone.utc),
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run_uuid}/"
        response = self.client.post(
            url,
            data={"payload": {"type": "interrupt"}},
            format="json",
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_request.assert_called_once()
        sent_data = orjson.loads(mock_request.call_args[0][2])
        # UUID must be translated to the numeric seer_run_state_id before Seer sees it
        assert sent_data["run_id"] == 456
        assert sent_data["organization_id"] == self.organization.id

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_uuid_run_still_mirroring_returns_409(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        """A UUID run whose seer_run_state_id is not yet populated should return 409."""
        mock_has_access.return_value = (True, None)

        run_uuid = uuid.uuid4()
        SeerRun.objects.create(
            organization=self.organization,
            uuid=run_uuid,
            seer_run_state_id=None,  # not yet mirrored
            type=SeerRunType.EXPLORER,
            mirror_status=SeerRunMirrorStatus.PENDING,
            last_triggered_at=datetime.now(tz=timezone.utc),
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run_uuid}/"
        response = self.client.post(url, data={"payload": {"type": "interrupt"}}, format="json")

        assert response.status_code == status.HTTP_409_CONFLICT
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_uuid_run_mirror_failed_returns_422(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        """A UUID run whose mirror failed should return 422."""
        mock_has_access.return_value = (True, None)

        run_uuid = uuid.uuid4()
        SeerRun.objects.create(
            organization=self.organization,
            uuid=run_uuid,
            seer_run_state_id=None,
            type=SeerRunType.EXPLORER,
            mirror_status=SeerRunMirrorStatus.FAILED,
            last_triggered_at=datetime.now(tz=timezone.utc),
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run_uuid}/"
        response = self.client.post(url, data={"payload": {"type": "interrupt"}}, format="json")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_missing_payload(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)

        response = self.client.post(
            self.url,
            data={},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Need a body with a payload" in str(response.data)
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    def test_explorer_update_ai_features_hidden(self, mock_has_access: MagicMock) -> None:
        mock_has_access.return_value = (False, "AI features are disabled for this organization.")

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "AI features are disabled" in str(response.data)

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    def test_explorer_update_no_seer_acknowledgement(self, mock_has_access: MagicMock) -> None:
        mock_has_access.return_value = (
            False,
            "Seer has not been acknowledged by the organization.",
        )

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Seer has not been acknowledged" in str(response.data)


class TestOrganizationSeerAgentUpdateFeatureFlags(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    def test_explorer_update_feature_flag_disabled(self, mock_has_access: MagicMock) -> None:
        mock_has_access.return_value = (False, "Feature flag not enabled")

        response = self.client.post(
            self.url,
            data={
                "payload": {
                    "type": "interrupt",
                },
            },
            format="json",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Feature flag not enabled" in str(response.data)


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class TestOrganizationSeerAgentUpdateCodingDisabled(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_coding_payload_blocked_when_coding_disabled(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)
        self.organization.update_option("sentry:enable_seer_coding", False)

        for payload_type in ("select_solution", "create_branch", "create_pr"):
            response = self.client.post(
                self.url, data={"payload": {"type": payload_type}}, format="json"
            )
            assert response.status_code == status.HTTP_403_FORBIDDEN
            assert response.data["detail"] == "Code generation is disabled for this organization"

        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_non_coding_payload_allowed_when_coding_disabled(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)
        self.organization.update_option("sentry:enable_seer_coding", False)
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {}

        response = self.client.post(
            self.url, data={"payload": {"type": "interrupt"}}, format="json"
        )
        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_request.assert_called_once()
