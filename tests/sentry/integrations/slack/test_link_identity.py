from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse
from slack_sdk.webhook import WebhookResponse

from sentry.integrations.slack.views.link_identity import (
    SUCCESS_LINKED_MESSAGE,
    build_linking_url,
)
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityStatus


class SlackIntegrationLinkIdentityTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

        self.external_id = "new-slack-id"
        self.channel_id = "my-channel"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

    @pytest.fixture(autouse=True)
    def mock_webhook_send(self) -> Generator[None]:
        with patch(
            "slack_sdk.webhook.WebhookClient.send",
            return_value=WebhookResponse(
                url="",
                body='{"ok": true}',
                headers={},
                status_code=200,
            ),
        ) as self.mock_webhook:
            yield

    @pytest.fixture(autouse=True)
    def mock_chat_postMessage(self) -> Generator[None]:
        with patch(
            "slack_sdk.web.WebClient.chat_postMessage",
            return_value=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": True},
                headers={},
                status_code=200,
            ),
        ) as self.mock_post:
            yield


@control_silo_test
class SlackIntegrationLinkIdentityTest(SlackIntegrationLinkIdentityTestBase):
    def test_basic_flow_with_webhook_client(self) -> None:
        """Do the auth flow and assert that the identity was created."""
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )

        # Load page.
        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        # Link identity of user
        self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user)

        assert len(identity) == 1
        assert identity[0].idp == self.idp
        assert identity[0].status == IdentityStatus.VALID
        assert self.mock_webhook.call_count == 1

    def test_basic_flow_with_webhook_client_error(self) -> None:
        """Do the auth flow and assert that the identity was created."""
        self.mock_webhook.side_effect = SlackApiError("", response={"ok": False})

        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )

        # Load page.
        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        # Link identity of user
        self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user)

        assert len(identity) == 1

    def test_basic_flow_with_web_client(self) -> None:
        """No response URL is provided, so we use WebClient."""
        linking_url = build_linking_url(self.integration, self.external_id, self.channel_id, "")

        # Load page.
        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        # Link identity of user
        self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user)

        assert len(identity) == 1
        assert identity[0].idp == self.idp
        assert identity[0].status == IdentityStatus.VALID
        assert self.mock_post.call_count == 1

    @patch("sentry.integrations.slack.utils.notifications._logger")
    def test_basic_flow_with_web_client_error(self, mock_logger: MagicMock) -> None:
        """No response URL is provided, so we use WebClient."""
        self.mock_post.side_effect = SlackApiError("", response={"ok": False})

        linking_url = build_linking_url(self.integration, self.external_id, self.channel_id, "")

        # Load page.
        response = self.client.get(linking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-link-identity.html")

        # Link identity of user
        self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user)

        assert len(identity) == 1

    @patch("sentry.integrations.slack.views.link_identity.route_slack_seer_event.apply_async")
    def test_replays_cached_pending_mention_on_link(self, mock_apply_async: MagicMock) -> None:
        from sentry.seer.entrypoints.cache import SeerOperatorPendingMentionCache
        from sentry.seer.entrypoints.slack.entrypoint import SlackPendingMentionPayload
        from sentry.seer.entrypoints.types import SeerEntrypointKey

        cached_payload = SlackPendingMentionPayload(
            payload={"method": "POST", "path": "/extensions/slack/event/"},
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
            channel_id="C1",
            thread_ts="100.000",
            message_ts="123.456",
            event_type="app_mention",
            message_text="hello",
        )
        SeerOperatorPendingMentionCache[SlackPendingMentionPayload].set(
            entrypoint_key=str(SeerEntrypointKey.SLACK),
            integration_id=self.integration.id,
            user_ext_id=self.external_id,
            cache_payload=cached_payload,
        )

        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        mock_apply_async.assert_called_once_with(kwargs=dict(cached_payload))
        assert (
            SeerOperatorPendingMentionCache[SlackPendingMentionPayload].pop(
                entrypoint_key=str(SeerEntrypointKey.SLACK),
                integration_id=self.integration.id,
                user_ext_id=self.external_id,
            )
            is None
        )

    @patch("sentry.integrations.slack.views.link_identity.route_slack_seer_event.apply_async")
    def test_dispatches_update_linking_when_response_url_present(
        self, mock_apply_async: MagicMock
    ) -> None:
        from sentry.seer.entrypoints.cache import SeerOperatorPendingMentionCache
        from sentry.seer.entrypoints.slack.entrypoint import SlackPendingMentionPayload
        from sentry.seer.entrypoints.types import SeerEntrypointKey

        cached_payload = SlackPendingMentionPayload(
            payload={"method": "POST", "path": "/extensions/slack/event/"},
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
            channel_id="C1",
            thread_ts="100.000",
            message_ts="123.456",
            event_type="app_mention",
            message_text="hello",
        )
        SeerOperatorPendingMentionCache[SlackPendingMentionPayload].set(
            entrypoint_key=str(SeerEntrypointKey.SLACK),
            integration_id=self.integration.id,
            user_ext_id=self.external_id,
            cache_payload=cached_payload,
        )

        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        mock_apply_async.assert_called_once()

    @patch("sentry.integrations.slack.views.link_identity.route_slack_seer_event.apply_async")
    def test_no_replay_when_cache_empty(self, mock_apply_async: MagicMock) -> None:
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        mock_apply_async.assert_not_called()

    def test_standard_flow_does_not_replace_original(self) -> None:
        """When response_url comes from linking URL params (e.g. issue card flow),
        the webhook must NOT replace the original message."""
        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        self.mock_webhook.assert_called_once()
        _, kwargs = self.mock_webhook.call_args
        assert kwargs["replace_original"] is False

    def test_stashed_flow_replaces_original(self) -> None:
        """When response_url comes from the stashed button click cache,
        the webhook should replace the original ephemeral."""
        from sentry.integrations.slack.views.link_identity import (
            stash_link_identity_response_url,
        )

        stashed_url = "https://hooks.slack.com/actions/stashed/url"
        stash_link_identity_response_url(
            integration_id=self.integration.id,
            slack_user_id=self.external_id,
            response_url=stashed_url,
        )

        linking_url = build_linking_url(
            self.integration, self.external_id, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        self.mock_webhook.assert_called_once_with(
            text=SUCCESS_LINKED_MESSAGE,
            replace_original=True,
            response_type="ephemeral",
        )

    def test_overwrites_existing_identities_with_sdk(self) -> None:
        external_id_2 = "slack-id2"

        # Create a second user.
        user2 = self.create_user(is_superuser=False)
        self.create_member(
            user=user2, organization=self.organization, role="member", teams=[self.team]
        )
        Identity.objects.create(
            user=user2, idp=self.idp, external_id=external_id_2, status=IdentityStatus.VALID
        )

        linking_url = build_linking_url(
            self.integration, external_id_2, self.channel_id, self.response_url
        )
        self.client.post(linking_url)

        assert Identity.objects.filter(external_id=external_id_2, user=self.user).exists()
        assert not Identity.objects.filter(external_id=self.external_id, user=self.user).exists()
        assert not Identity.objects.filter(external_id=external_id_2, user=user2).exists()


@control_silo_test
class SlackIntegrationUnlinkIdentityTest(SlackIntegrationLinkIdentityTestBase):
    def setUp(self) -> None:
        super().setUp()

        self.unlinking_url = build_unlinking_url(
            self.integration.id,
            self.external_id,
            self.channel_id,
            self.response_url,
        )

    def test_basic_flow(self) -> None:
        # Load page.
        response = self.client.get(self.unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/auth-unlink-identity.html")

        # Unlink identity of user.
        response = self.client.post(self.unlinking_url)
        assert response.status_code == 200
        self.assertTemplateUsed(response, "sentry/integrations/slack/unlinked.html")

        assert not Identity.objects.filter(external_id="new-slack-id", user=self.user).exists()
        assert self.mock_webhook.call_count == 1

    def test_user_with_multiple_organizations(self) -> None:
        # Create a second organization where the user is _not_ a member.
        self.create_organization_integration(
            organization_id=self.create_organization(name="Another Org").id,
            integration=self.integration,
        )

        # Unlink identity of user.
        self.client.post(self.unlinking_url)
        assert not Identity.objects.filter(external_id="new-slack-id", user=self.user).exists()
        assert self.mock_webhook.call_count == 1
