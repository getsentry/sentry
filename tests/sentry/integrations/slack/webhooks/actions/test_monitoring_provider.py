from unittest.mock import MagicMock, patch

import orjson

from sentry.integrations.slack.webhooks.monitoring_provider import (
    MONITORING_PROVIDER_CALLBACK_ID,
    build_monitoring_provider_modal,
    handle_monitoring_provider_submission,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.slack import add_identity
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider, OrganizationIdentity

from . import BaseEventTest

OPEN_MODAL_PATH = "sentry.integrations.slack.webhooks.action.open_monitoring_provider_modal"


class TestBuildMonitoringProviderModal(TestCase):
    def test_single_org_no_org_selector(self) -> None:
        orgs = [(self.organization.id, self.organization.slug)]
        modal = build_monitoring_provider_modal(
            provider_key="datadog_pat",
            orgs=orgs,
            channel_id="C123",
            thread_ts=None,
            run_id=None,
        )
        block_ids = [b.block_id for b in modal.blocks]
        assert "org_block" not in block_ids
        assert "site_block" in block_ids
        assert "token_block" in block_ids

        assert modal.private_metadata is not None
        metadata = orjson.loads(modal.private_metadata)
        assert metadata["org_id"] == self.organization.id
        assert metadata["provider_key"] == "datadog_pat"
        assert metadata["channel_id"] == "C123"

    def test_multi_org_shows_org_selector(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)
        orgs = [
            (self.organization.id, self.organization.slug),
            (org2.id, org2.slug),
        ]
        modal = build_monitoring_provider_modal(
            provider_key="datadog_pat",
            orgs=orgs,
            channel_id="C123",
            thread_ts=None,
            run_id=None,
        )
        block_ids = [b.block_id for b in modal.blocks]
        assert "org_block" in block_ids

        assert modal.private_metadata is not None
        metadata = orjson.loads(modal.private_metadata)
        assert metadata["org_id"] is None

    def test_provider_without_sites_omits_site_block(self) -> None:
        orgs = [(self.organization.id, self.organization.slug)]
        modal = build_monitoring_provider_modal(
            provider_key="gcp",
            orgs=orgs,
            channel_id="C123",
            thread_ts=None,
            run_id=None,
        )
        block_ids = [b.block_id for b in modal.blocks]
        assert "site_block" not in block_ids
        assert "token_block" in block_ids

    def test_modal_title_uses_provider_name(self) -> None:
        orgs = [(self.organization.id, self.organization.slug)]
        modal = build_monitoring_provider_modal(
            provider_key="datadog_pat",
            orgs=orgs,
            channel_id="C123",
            thread_ts=None,
            run_id=None,
        )
        assert modal.title is not None
        assert modal.title.text == "Connect Datadog (Personal Access Token)"

    def test_private_metadata_includes_thread_ts_and_run_id(self) -> None:
        orgs = [(self.organization.id, self.organization.slug)]
        modal = build_monitoring_provider_modal(
            provider_key="datadog_pat",
            orgs=orgs,
            channel_id="C123",
            thread_ts="1234567890.123456",
            run_id="run-abc",
        )
        assert modal.private_metadata is not None
        metadata = orjson.loads(modal.private_metadata)
        assert metadata["thread_ts"] == "1234567890.123456"
        assert metadata["run_id"] == "run-abc"


def _make_mock_slack_request(
    *,
    integration_id: int,
    team_id: str,
    user_id: str,
    private_metadata: dict,
    token: str = "pat-abc",
    site: str | None = "datadoghq.com",
) -> MagicMock:
    state_values: dict = {
        "token_block": {
            "token_input": {
                "type": "plain_text_input",
                "value": token,
            }
        },
    }
    if site is not None:
        state_values["site_block"] = {
            "site_select": {
                "type": "static_select",
                "selected_option": {
                    "text": {"type": "plain_text", "text": site},
                    "value": site,
                },
            }
        }

    mock_request = MagicMock()
    mock_request.data = {
        "type": "view_submission",
        "team": {"id": team_id},
        "user": {"id": user_id},
        "view": {
            "id": "V_MODAL_123",
            "type": "modal",
            "callback_id": MONITORING_PROVIDER_CALLBACK_ID,
            "private_metadata": orjson.dumps(private_metadata).decode(),
            "state": {"values": state_values},
        },
    }
    mock_request.integration = MagicMock()
    mock_request.integration.id = integration_id
    mock_request.user_id = user_id
    return mock_request


@control_silo_test
class TestMonitoringProviderSubmission(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, "UXXXXXXX1")
        self.private_metadata = {
            "provider_key": "datadog_pat",
            "org_id": self.organization.id,
            "channel_id": "C065W1189",
            "thread_ts": None,
            "run_id": None,
        }

    def _make_request(
        self,
        *,
        token: str = "pat-abc",
        site: str | None = "datadoghq.com",
        private_metadata: dict | None = None,
    ) -> MagicMock:
        mock_request = _make_mock_slack_request(
            integration_id=self.integration.id,
            team_id="TXXXXXXX1",
            user_id="UXXXXXXX1",
            private_metadata=private_metadata or self.private_metadata,
            token=token,
            site=site,
        )
        mock_request.get_identity_user.return_value = MagicMock(id=self.user.id)
        mock_request.get_identity.return_value = MagicMock(
            id=Identity.objects.get(idp=self.idp, user=self.user).id,
            data={},
        )
        return mock_request

    @patch("sentry.integrations.slack.webhooks.monitoring_provider._send_success_ephemeral")
    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_successful_submission_creates_identity(
        self, mock_get_user_info: MagicMock, mock_send: MagicMock
    ) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
            "user_email": "user@example.com",
            "user_name": "Test User",
        }

        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(self._make_request())

        assert result is None

        idp = IdentityProvider.objects.get(type="datadog_pat", external_id="dd-org-456")
        identity = Identity.objects.get(idp=idp, user=self.user)
        assert identity.external_id == "dd-user-123"
        assert identity.data == {"access_token": "pat-abc", "site": "datadoghq.com"}
        assert OrganizationIdentity.objects.filter(
            organization_id=self.organization.id, identity=identity
        ).exists()

    @patch("sentry.integrations.slack.webhooks.monitoring_provider._send_success_ephemeral")
    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_successful_submission_sends_ephemeral(
        self, mock_get_user_info: MagicMock, mock_send: MagicMock
    ) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
        }

        with self.feature("organizations:seer-infra-telemetry"):
            handle_monitoring_provider_submission(self._make_request())

        mock_send.assert_called_once()
        assert mock_send.call_args[1]["provider_key"] == "datadog_pat"
        assert mock_send.call_args[1]["channel_id"] == "C065W1189"

    def test_submission_empty_token_returns_error(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(self._make_request(token=""))

        assert result is not None
        assert result["response_action"] == "errors"
        assert "token_block" in result["errors"]

    def test_submission_whitespace_token_returns_error(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(self._make_request(token="   "))

        assert result is not None
        assert result["response_action"] == "errors"
        assert "token_block" in result["errors"]

    @patch(
        "sentry.identity.datadog.provider.get_user_info", side_effect=ValueError("Invalid API key")
    )
    def test_submission_invalid_token_returns_error(self, mock_get_user_info: MagicMock) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(self._make_request())

        assert result is not None
        assert result["response_action"] == "errors"
        assert "token_block" in result["errors"]

    def test_submission_without_feature_flag_returns_error(self) -> None:
        result = handle_monitoring_provider_submission(self._make_request())

        assert result is not None
        assert result["response_action"] == "errors"
        assert "infrastructure monitoring" in result["errors"]["org_block"]

    def test_submission_invalid_provider_returns_none(self) -> None:
        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(
                self._make_request(
                    private_metadata={
                        "provider_key": "nonexistent",
                        "org_id": self.organization.id,
                        "channel_id": "C065W1189",
                        "thread_ts": None,
                        "run_id": None,
                    },
                )
            )

        assert result is None

    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_submission_already_connected_returns_error(
        self, mock_get_user_info: MagicMock
    ) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
        }

        other_user = self.create_user()
        idp = self.create_identity_provider(type="datadog_pat", external_id="dd-org-456")
        self.create_identity(
            user=other_user,
            identity_provider=idp,
            external_id="dd-user-123",
            data={"access_token": "other-tok", "site": "datadoghq.com"},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            result = handle_monitoring_provider_submission(self._make_request())

        assert result is not None
        assert result["response_action"] == "errors"
        assert "already connected" in result["errors"]["token_block"]

    @patch("sentry.integrations.slack.webhooks.monitoring_provider._send_success_ephemeral")
    @patch("sentry.identity.datadog.provider.get_user_info")
    def test_submission_clears_declined_provider(
        self, mock_get_user_info: MagicMock, mock_send: MagicMock
    ) -> None:
        mock_get_user_info.return_value = {
            "user_uuid": "dd-user-123",
            "org_uuid": "dd-org-456",
        }

        slack_identity = Identity.objects.get(idp=self.idp, user=self.user)
        slack_identity.update(data={"declined_monitoring_providers": ["datadog_pat", "gcp"]})

        mock_request = self._make_request()
        mock_request.get_identity.return_value = MagicMock(
            id=slack_identity.id,
            data={"declined_monitoring_providers": ["datadog_pat", "gcp"]},
        )

        with self.feature("organizations:seer-infra-telemetry"):
            handle_monitoring_provider_submission(mock_request)

        slack_identity.refresh_from_db()
        assert slack_identity.data["declined_monitoring_providers"] == ["gcp"]


class TestConnectMonitoringProviderAction(BaseEventTest):
    @patch(OPEN_MODAL_PATH, return_value=None)
    def test_connect_action_opens_modal(self, mock_open_modal: MagicMock) -> None:
        response = self.post_webhook_block_kit(
            action_data=[
                {
                    "action_id": "connect_monitoring_provider",
                    "value": "datadog_pat",
                    "type": "button",
                }
            ],
        )
        assert response.status_code == 200
        mock_open_modal.assert_called_once()
        call_args = mock_open_modal.call_args
        assert call_args[0][1] == "datadog_pat"

    @patch(OPEN_MODAL_PATH, return_value="You need to link your Sentry identity first.")
    def test_connect_action_returns_error_as_ephemeral(self, mock_open_modal: MagicMock) -> None:
        response = self.post_webhook_block_kit(
            action_data=[
                {
                    "action_id": "connect_monitoring_provider",
                    "value": "datadog_pat",
                    "type": "button",
                }
            ],
        )
        assert response.status_code == 200
        assert "link your Sentry identity" in response.data["text"]


class TestSkipMonitoringProviderAction(BaseEventTest):
    def test_skip_action_returns_200(self) -> None:
        response = self.post_webhook_block_kit(
            action_data=[
                {
                    "action_id": "skip_monitoring_provider",
                    "value": "datadog_pat",
                    "type": "button",
                }
            ],
        )
        assert response.status_code == 200

    def test_decline_action_persists_on_identity(self) -> None:
        response = self.post_webhook_block_kit(
            action_data=[
                {
                    "action_id": "decline_monitoring_provider",
                    "value": "datadog_pat",
                    "type": "button",
                }
            ],
        )
        assert response.status_code == 200

        with assume_test_silo_mode(SiloMode.CONTROL):
            slack_identity = Identity.objects.get(idp=self.idp, user=self.user)
            assert "datadog_pat" in slack_identity.data["declined_monitoring_providers"]

    def test_decline_action_appends_to_existing(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            slack_identity = Identity.objects.get(idp=self.idp, user=self.user)
            slack_identity.update(data={"declined_monitoring_providers": ["gcp"]})

        self.post_webhook_block_kit(
            action_data=[
                {
                    "action_id": "decline_monitoring_provider",
                    "value": "datadog_pat",
                    "type": "button",
                }
            ],
        )

        with assume_test_silo_mode(SiloMode.CONTROL):
            slack_identity.refresh_from_db()
            assert sorted(slack_identity.data["declined_monitoring_providers"]) == [
                "datadog_pat",
                "gcp",
            ]

    def test_decline_action_idempotent(self) -> None:
        for _ in range(2):
            self.post_webhook_block_kit(
                action_data=[
                    {
                        "action_id": "decline_monitoring_provider",
                        "value": "datadog_pat",
                        "type": "button",
                    }
                ],
            )

        with assume_test_silo_mode(SiloMode.CONTROL):
            slack_identity = Identity.objects.get(idp=self.idp, user=self.user)
            assert slack_identity.data["declined_monitoring_providers"] == ["datadog_pat"]
