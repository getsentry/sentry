from unittest.mock import MagicMock, patch

import orjson
from rest_framework import status

from sentry.integrations.types import ExternalProviders
from sentry.seer.models.run import SeerRunMirrorStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


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
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=123, user_id=self.user.id
        )

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
    def test_explorer_update_owned_by_another_user_is_denied(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(user=member)

        response = self.client.post(
            self.url, data={"payload": {"type": "interrupt"}}, format="json"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data == {
            "detail": "This conversation belongs to another user and is read-only."
        }
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_with_org_auth_token_is_denied(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)
        token = generate_token(self.organization.slug, "")
        self.create_org_auth_token(
            name="org-auth-token",
            token_hashed=hash_token(token),
            organization_id=self.organization.id,
            scope_list=["org:read"],
        )

        response = self.client.post(
            self.url,
            data={"payload": {"type": "interrupt"}},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data == {"detail": "A user account is required to update a conversation."}
        mock_request.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_explorer_update_with_uuid_run_id(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        """UUID run_id should be resolved to the numeric seer_run_state_id before forwarding to Seer."""
        mock_has_access.return_value = (True, None)
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {"run_id": 456}

        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=456,
            user_id=self.user.id,
            mirror_status=SeerRunMirrorStatus.LIVE,
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run.uuid}/"
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

        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=None,
            user_id=self.user.id,
            mirror_status=SeerRunMirrorStatus.PENDING,
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run.uuid}/"
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

        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=None,
            user_id=self.user.id,
            mirror_status=SeerRunMirrorStatus.FAILED,
        )

        url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/{run.uuid}/"
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
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=123, user_id=self.user.id
        )

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


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
class TestOrganizationSeerAgentUpdateCommitAuthor(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.url = f"/api/0/organizations/{self.organization.slug}/seer/explorer-update/123/"
        self.create_seer_run(
            organization=self.organization, seer_run_state_id=123, user_id=self.user.id
        )

    def _sent_payload(self, mock_request: MagicMock, payload_type: str) -> dict:
        mock_request.return_value.status = 200
        mock_request.return_value.json.return_value = {}
        spoofed = {"name": "Someone Else", "email": "victim@example.com"}

        response = self.client.post(
            self.url, data={"payload": {"type": payload_type, "author": spoofed}}, format="json"
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        return orjson.loads(mock_request.call_args[0][2])["payload"]

    @patch("sentry.seer.endpoints.organization_seer_agent_update.has_seer_agent_access_with_detail")
    @patch("sentry.seer.endpoints.organization_seer_agent_update.make_signed_seer_api_request")
    def test_client_supplied_author_is_never_forwarded_on_create_pr(
        self, mock_request: MagicMock, mock_has_access: MagicMock
    ) -> None:
        mock_has_access.return_value = (True, None)

        # No GitHub identity for the acting user, so the spoofed author is dropped.
        assert "author" not in self._sent_payload(mock_request, "create_pr")

        self.create_external_user(
            user=self.user,
            organization=self.organization,
            provider=ExternalProviders.GITHUB.value,
            external_name="@octocat",
            external_id="583231",
            integration=self.create_integration(
                organization=self.organization, provider="github", external_id="gh:1"
            ),
        )
        assert self._sent_payload(mock_request, "create_pr")["author"] == {
            "name": self.user.get_display_name(),
            "email": "583231+octocat@users.noreply.github.com",
        }

        # A spoofed author is stripped on every payload type, not just create_pr.
        assert "author" not in self._sent_payload(mock_request, "interrupt")
