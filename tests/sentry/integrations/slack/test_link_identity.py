from unittest.mock import patch

import pytest
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse
from slack_sdk.webhook import WebhookResponse

from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityStatus


class SlackIntegrationLinkIdentityTestBase(TestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.external_id = "new-slack-id"
        self.channel_id = "my-channel"
        self.response_url = "http://example.slack.com/response_url"

        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

    @pytest.fixture(autouse=True)
    def mock_webhook_send(self):
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
    def mock_chat_postMessage(self):
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
    def test_basic_flow_with_webhook_client(self):
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

    @patch("sentry.integrations.slack.utils.notifications._logger")
    def test_basic_flow_with_webhook_client_error(self, mock_logger):
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
        assert mock_logger.exception.call_count == 1
        assert mock_logger.exception.call_args.args == ("slack.link-identity.error",)

    def test_basic_flow_with_web_client(self):
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
    def test_basic_flow_with_web_client_error(self, mock_logger):
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
        assert mock_logger.exception.call_count == 1
        assert mock_logger.exception.call_args.args == ("slack.link-identity.error",)

    def test_overwrites_existing_identities_with_sdk(self):
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
    def setUp(self):
        super().setUp()

        self.unlinking_url = build_unlinking_url(
            self.integration.id,
            self.external_id,
            self.channel_id,
            self.response_url,
        )

    def test_basic_flow(self):
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

    def test_user_with_multiple_organizations(self):
        # Create a second organization where the user is _not_ a member.
        self.create_organization_integration(
            organization_id=self.create_organization(name="Another Org").id,
            integration=self.integration,
        )

        # Unlink identity of user.
        self.client.post(self.unlinking_url)
        assert not Identity.objects.filter(external_id="new-slack-id", user=self.user).exists()
        assert self.mock_webhook.call_count == 1
