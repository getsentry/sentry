from unittest import mock
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import orjson
import pytest
from django.test import RequestFactory
from django.utils.functional import cached_property

from sentry import options
from sentry.integrations.messaging.metrics import SeerSlackHaltReason
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.requests.action import SlackActionRequest
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.requests.event import SlackEventRequest
from sentry.integrations.slack.utils.auth import set_signing_secret
from sentry.integrations.slack.utils.constants import SlackScope
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.models.organization import OrganizationStatus
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test


@control_silo_test
class SlackRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "type": "foo",
            "team_id": "T001",
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self) -> SlackRequest:
        return SlackRequest(self.request)

    @patch("slack_sdk.signature.SignatureVerifier.is_valid")
    def test_validate_using_sdk(self, mock_verify: MagicMock) -> None:
        self.create_integration(
            organization=self.organization, external_id="T001", provider="slack"
        )
        self.slack_request.validate()

        mock_verify.assert_called()

    def test_exposes_data(self) -> None:
        assert self.slack_request.data["type"] == "foo"

    def test_exposes_team_id(self) -> None:
        assert self.slack_request.team_id == "T001"

    def test_collects_logging_data(self) -> None:
        assert self.slack_request.logging_data == {
            "slack_team_id": "T001",
            "slack_channel_id": "1",
            "slack_user_id": "2",
            "slack_api_app_id": "S1",
        }

    def test_disregards_None_logging_values(self) -> None:
        self.request.data["api_app_id"] = None

        assert self.slack_request.logging_data == {
            "slack_team_id": "T001",
            "slack_channel_id": "1",
            "slack_user_id": "2",
        }

    @pytest.mark.xfail(strict=True, reason="crashes in _log_request before validation can occur")
    def test_returns_400_on_invalid_data(self) -> None:
        type(self.request).data = mock.PropertyMock(side_effect=ValueError())

        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 400

    @override_options({"slack.signing-secret": None})  # force token-auth
    def test_returns_401_on_invalid_token(self) -> None:
        self.request.data["token"] = "notthetoken"

        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 401

    def test_validates_existence_of_integration(self) -> None:
        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 403

    def test_none_in_data(self) -> None:
        request = mock.Mock()
        request.data = {
            "type": "foo",
            "team": None,
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        request.body = urlencode(self.request.data).encode("utf-8")
        request.META = (options.get("slack.signing-secret"), self.request.body)

        slack_request = SlackRequest(request)
        assert slack_request.team_id is None
        assert slack_request.logging_data == {
            "slack_channel_id": "1",
            "slack_user_id": "2",
            "slack_api_app_id": "S1",
        }


class SlackEventRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.integration = self.create_integration(
            organization=self.organization, external_id="T001", provider="slack"
        )
        self.request = mock.Mock()
        self.request.data = {
            "type": "foo",
            "team_id": "T001",
            "event_id": "E1",
            "event": {"type": "bar"},
            "channel": {"id": "1"},
            "user": {"id": "2"},
            "api_app_id": "S1",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self) -> SlackEventRequest:
        return SlackEventRequest(self.request)

    def test_ignores_event_validation_on_challenge_request(self) -> None:
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }

        # It would raise if it didn't skip event validation and didn't find
        # the `event` key.
        self.slack_request.validate()

    def test_is_challenge(self) -> None:
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }

        assert self.slack_request.is_challenge()

    def test_validate_missing_event(self) -> None:
        self.request.data.pop("event")

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_validate_missing_event_type(self) -> None:
        self.request.data["event"] = {}

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_type(self) -> None:
        assert self.slack_request.type == "bar"

    def test_signing_secret_bad(self) -> None:
        self.request.data = {
            "token": options.get("slack.verification-token"),
            "challenge": "abc123",
            "type": "url_verification",
        }
        self.request.body = urlencode(self.request.data).encode("utf-8")

        self.request.META = set_signing_secret("bad_key", self.request.body)
        with pytest.raises(SlackRequestError) as e:
            self.slack_request.validate()
        assert e.value.status == 401

    def test_use_verification_token(self) -> None:
        with override_options({"slack.signing-secret": None}):
            self.request.data = {
                "token": options.get("slack.verification-token"),
                "challenge": "abc123",
                "type": "url_verification",
            }
            self.request.body = orjson.dumps(self.request.data)

            self.slack_request.validate()

    def test_is_seer_agent_request(self) -> None:
        self.request.data["event"] = {"type": "app_mention"}
        assert SlackEventRequest(self.request).is_seer_agent_request is True

        self.request.data["event"] = {"type": "assistant_thread_started"}
        assert SlackEventRequest(self.request).is_seer_agent_request is True

        self.request.data["event"] = {"type": "link_shared"}
        assert SlackEventRequest(self.request).is_seer_agent_request is False

    def test_is_seer_agent_request_dm_checks_assistant_scope(self) -> None:
        self.request.data["event"] = {"type": "message"}

        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["scopes"] = [SlackScope.ASSISTANT_WRITE.value]
            self.integration.save()
        rpc_integration = integration_service.get_integration(integration_id=self.integration.id)

        req = SlackEventRequest(self.request)
        req._integration = rpc_integration
        assert req.is_seer_agent_request is True

        with assume_test_silo_mode_of(Integration):
            self.integration.metadata["scopes"] = []
            self.integration.save()
        rpc_integration = integration_service.get_integration(integration_id=self.integration.id)

        req = SlackEventRequest(self.request)
        req._integration = rpc_integration
        assert req.is_seer_agent_request is False

    def test_is_assistant_thread_event(self) -> None:
        self.request.data["event"] = {"type": "assistant_thread_started"}
        assert SlackEventRequest(self.request).is_assistant_thread_event is True

        self.request.data["event"] = {"type": "app_mention"}
        assert SlackEventRequest(self.request).is_assistant_thread_event is False

    def test_channel_id(self) -> None:
        self.request.data["event"] = {
            "type": "message",
            "channel": "C_REGULAR",
            "assistant_thread": {"channel_id": "C_ASSISTANT", "user_id": "U1", "thread_ts": "1.0"},
        }
        assert SlackEventRequest(self.request).channel_id == "C_REGULAR"
        self.request.data["event"]["type"] = "assistant_thread_started"
        assert SlackEventRequest(self.request).channel_id == "C_ASSISTANT"

    def test_user_id(self) -> None:
        self.request.data["event"] = {
            "type": "message",
            "user": "U_REGULAR",
            "assistant_thread": {
                "channel_id": "C1",
                "user_id": "U_ASSISTANT",
                "thread_ts": "1.0",
            },
        }
        assert SlackEventRequest(self.request).user_id == "U_REGULAR"
        self.request.data["event"]["type"] = "assistant_thread_started"
        assert SlackEventRequest(self.request).user_id == "U_ASSISTANT"

    def test_thread_ts(self) -> None:
        self.request.data["event"] = {
            "type": "app_mention",
            "thread_ts": "111.222",
            "assistant_thread": {"channel_id": "C1", "user_id": "U1", "thread_ts": "333.444"},
        }
        assert SlackEventRequest(self.request).thread_ts == "111.222"
        self.request.data["event"]["type"] = "assistant_thread_started"
        assert SlackEventRequest(self.request).thread_ts == "333.444"


class SlackEventRequestSeerResolutionTest(TestCase):
    factory = RequestFactory()

    def setUp(self) -> None:
        self.slack_user = self.create_user()
        self.organization = self.create_organization(owner=self.slack_user)
        self.integration = self.create_integration(
            organization=self.organization, external_id="T_SEER", provider="slack"
        )
        self.identity_provider = self.create_identity_provider(integration=self.integration)
        self.identity = self.create_identity(
            user=self.slack_user,
            identity_provider=self.identity_provider,
            external_id="U_SLACK",
        )
        patcher = patch(
            "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
            return_value=True,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

        data = {
            "type": "event_callback",
            "team_id": "T_SEER",
            "event_id": "E1",
            "api_app_id": "A1",
            "event": {
                "type": "app_mention",
                "channel": "C1",
                "user": "U_SLACK",
                "ts": "1.0",
            },
        }
        request = self.factory.post(
            "/extensions/slack/event/",
            data=orjson.dumps(data),
            content_type="application/json",
        )
        drf_request = SlackDMEndpoint().initialize_request(request)
        self.slack_request = SlackEventRequest(drf_request)
        self.slack_request.authorize()
        self.slack_request.validate_integration()

    def _add_second_org(self, slug: str = "second-org"):
        org = self.create_organization(slug=slug, owner=self.slack_user)
        self.create_organization_integration(organization_id=org.id, integration=self.integration)
        return org

    def _build_request(self, *, text: str = "", thread_ts: str = "") -> SlackEventRequest:
        data = {
            "type": "event_callback",
            "team_id": "T_SEER",
            "event_id": "E1",
            "api_app_id": "A1",
            "event": {
                "type": "app_mention",
                "channel": "C1",
                "user": "U_SLACK",
                "ts": "1.0",
                "text": text,
                "thread_ts": thread_ts,
            },
        }
        request = self.factory.post(
            "/extensions/slack/event/",
            data=orjson.dumps(data),
            content_type="application/json",
        )
        drf_request = SlackDMEndpoint().initialize_request(request)
        slack_request = SlackEventRequest(drf_request)
        slack_request.authorize()
        slack_request.validate_integration()
        return slack_request

    def test_identity_not_linked(self):
        with assume_test_silo_mode_of(self.identity):
            self.identity.delete()
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.IDENTITY_NOT_LINKED

    def test_no_organization_integrations(self):
        with assume_test_silo_mode_of(OrganizationIntegration):
            OrganizationIntegration.objects.filter(integration_id=self.integration.id).delete()
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_INTEGRATION

    def test_org_not_found(self):
        self.organization.delete()
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_ORGANIZATION

    def test_org_not_active(self):
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_ORGANIZATION

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=False,
    )
    def test_org_no_seer_access(self, mock_access):
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_ORGANIZATION

    def test_user_not_member(self):
        non_member = self.create_user()
        with assume_test_silo_mode_of(self.identity):
            self.identity.update(user=non_member)
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_ORGANIZATION

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_resolves_valid_organization(self, mock_access):
        result = self.slack_request.resolve_seer_organization()
        assert result.organization_id == self.organization.id
        assert result.halt_reason is None

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_feature_flag",
        return_value=True,
    )
    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=False,
    )
    def test_control_silo_skips_subscription_gated_access_check(
        self, mock_has_access, mock_has_feature_flag
    ):
        """
        In control silo, has_access is not consulted (it depends on subscription context
        that getsentry's FlagpoleFeatureHandler does not populate in control silo).
        Only has_feature_flag gates the control-silo check; the full verdict is deferred
        to the cell handler.
        """
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            result = self.slack_request.resolve_seer_organization()

        assert result.organization_id == self.organization.id
        assert result.halt_reason is None
        mock_has_feature_flag.assert_called()
        mock_has_access.assert_not_called()

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_feature_flag",
        return_value=False,
    )
    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_control_silo_halts_when_feature_flag_disabled(
        self, mock_has_access, mock_has_feature_flag
    ):
        with assume_test_silo_mode(SiloMode.CONTROL, can_be_monolith=False):
            result = self.slack_request.resolve_seer_organization()

        assert result.organization_id is None
        assert result.halt_reason == SeerSlackHaltReason.NO_VALID_ORGANIZATION
        mock_has_feature_flag.assert_called()
        mock_has_access.assert_not_called()

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_feature_flag",
        return_value=True,
    )
    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_cell_silo_uses_full_access_check(self, mock_has_access, mock_has_feature_flag):
        """
        In cell silo, has_access (the subscription-gated check) is the gate.
        has_feature_flag is not consulted independently — it only runs inside has_access.
        """
        with assume_test_silo_mode(SiloMode.CELL, can_be_monolith=False):
            result = self.slack_request.resolve_seer_organization()

        assert result.organization_id == self.organization.id
        assert result.halt_reason is None
        mock_has_access.assert_called()
        mock_has_feature_flag.assert_not_called()

    @patch("sentry.integrations.slack.requests.event.get_thread_history")
    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_multi_org_resolves_from_message_link(self, mock_access, mock_get_thread_history):
        other_org = self._add_second_org()
        slack_request = self._build_request(
            text=f"<@U_BOT> what about https://{other_org.slug}.sentry.io/issues/123/ ?"
        )
        result = slack_request.resolve_seer_organization()
        assert result.organization_id == other_org.id
        assert result.halt_reason is None
        # No need to check the thread if we have a link in the initial message.
        assert mock_get_thread_history.call_count == 0

    @patch("sentry.integrations.slack.requests.event.get_thread_history")
    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_multi_org_resolves_from_thread(self, mock_access, mock_get_thread_history):
        other_org = self._add_second_org()
        mock_get_thread_history.return_value = [
            {"user": "U_OTHER", "text": f"https://{other_org.slug}.sentry.io/issues/42/"},
            {"user": "U_SLACK", "text": "<@U_BOT> help"},
        ]
        slack_request = self._build_request(text="<@U_BOT> help", thread_ts="0.9")
        result = slack_request.resolve_seer_organization()
        assert result.organization_id == other_org.id
        assert result.halt_reason is None

    @patch(
        "sentry.integrations.slack.requests.event.SlackAgentEntrypoint.has_access",
        return_value=True,
    )
    def test_multi_org_ignores_link_for_unavailable_org(self, mock_access):
        self._add_second_org()
        slack_request = self._build_request(
            text="<@U_BOT> https://sentry.io/organizations/not-my-org/issues/123/"
        )
        result = slack_request.resolve_seer_organization()
        assert result.organization_id == self.organization.id
        assert result.halt_reason is None


class SlackActionRequestTest(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.request = mock.Mock()
        self.request.data = {
            "payload": orjson.dumps(
                {
                    "type": "foo",
                    "team": {"id": "T001"},
                    "channel": {"id": "1"},
                    "user": {"id": "2"},
                    "token": options.get("slack.verification-token"),
                    "callback_id": '{"issue":"I1"}',
                }
            ).decode()
        }
        self.request.body = urlencode(self.request.data).encode()
        self.request.META = set_signing_secret(
            options.get("slack.signing-secret"), self.request.body
        )

    @cached_property
    def slack_request(self) -> SlackActionRequest:
        return SlackActionRequest(self.request)

    def test_type(self) -> None:
        assert self.slack_request.type == "foo"

    def test_callback_data(self) -> None:
        assert self.slack_request.callback_data == {"issue": "I1"}

    def test_validates_existence_of_payload(self) -> None:
        self.request.data.pop("payload")

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()

    def test_validates_payload_json(self) -> None:
        self.request.data["payload"] = "notjson"

        with pytest.raises(SlackRequestError):
            self.slack_request.validate()
