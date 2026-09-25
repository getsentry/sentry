from collections.abc import Generator
from unittest.mock import MagicMock, call, patch

import pytest
from django.http import Http404
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse
from slack_sdk.webhook import WebhookResponse

from sentry.constants import ObjectStatus
from sentry.integrations.messaging.linkage import UnlinkIdentityView
from sentry.integrations.slack.views.link_identity import (
    SUCCESS_LINKED_MESSAGE,
    build_linking_url,
)
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.integrations.types import ExternalProviders
from sentry.integrations.utils.identities import get_identity_or_404
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityStatus


@control_silo_test
class GetIdentityOrganizationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, "slack-user")

    def test_default_organization(self) -> None:
        organization, integration, idp = get_identity_or_404(
            ExternalProviders.SLACK, self.user, self.integration.id
        )

        assert organization.id == self.organization.id
        assert integration == self.integration
        assert idp == self.idp

    def test_explicit_valid_organization(self) -> None:
        other_organization = self.create_organization(owner=self.user)
        self.create_organization_integration(
            organization_id=other_organization.id, integration=self.integration
        )

        organization, integration, idp = get_identity_or_404(
            ExternalProviders.SLACK,
            self.user,
            self.integration.id,
            organization_id=other_organization.id,
        )

        assert organization.id == other_organization.id
        assert integration == self.integration
        assert idp == self.idp

    def test_explicit_organization_without_membership(self) -> None:
        other_organization = self.create_organization(owner=self.create_user())
        self.create_organization_integration(
            organization_id=other_organization.id, integration=self.integration
        )

        with pytest.raises(Http404):
            get_identity_or_404(
                ExternalProviders.SLACK,
                self.user,
                self.integration.id,
                organization_id=other_organization.id,
            )

    def test_explicit_organization_without_integration(self) -> None:
        other_organization = self.create_organization(owner=self.user)

        with pytest.raises(Http404):
            get_identity_or_404(
                ExternalProviders.SLACK,
                self.user,
                self.integration.id,
                organization_id=other_organization.id,
            )

    def test_explicit_organization_with_inactive_installation(self) -> None:
        other_organization = self.create_organization(owner=self.user)
        self.create_organization_integration(
            organization_id=other_organization.id,
            integration=self.integration,
            status=ObjectStatus.DISABLED,
        )

        with pytest.raises(Http404):
            get_identity_or_404(
                ExternalProviders.SLACK,
                self.user,
                self.integration.id,
                organization_id=other_organization.id,
            )


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

    def test_unlinks_staging_identity(self) -> None:
        # The Slack identity provider registers some identities as `slack_staging`; the
        # resolved idp, not the view's `slack` slug, must scope the delete.
        staging = self.create_provider_integration(
            provider="slack_staging", external_id="TSTAGING", metadata=self.integration.metadata
        )
        self.create_organization_integration(
            organization_id=self.organization.id, integration=staging
        )
        staging_idp = self.create_identity_provider(type="slack_staging", external_id="TSTAGING")
        self.create_identity(
            user=self.user, identity_provider=staging_idp, external_id="staging-slack-id"
        )

        response = self.client.post(
            build_unlinking_url(staging.id, "staging-slack-id", self.channel_id, self.response_url)
        )

        assert response.status_code == 200
        assert not Identity.objects.filter(idp=staging_idp, external_id="staging-slack-id").exists()
        assert Identity.objects.filter(idp=self.idp, external_id=self.external_id).exists()

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

    def test_cannot_unlink_another_user(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)
        other_identity = self.create_identity(other_user, self.idp, "other-slack-id")
        self.login_as(other_user)

        with (
            patch.object(UnlinkIdentityView, "record_analytic") as record_analytic,
            patch.object(UnlinkIdentityView, "_send_nudge_notification") as send_nudge,
            patch.object(UnlinkIdentityView, "capture_metric") as capture_metric,
        ):
            response = self.client.post(self.unlinking_url)

        assert response.status_code == 404
        assert Identity.objects.filter(idp=self.idp, user=self.user).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()
        self.mock_webhook.assert_not_called()
        self.mock_post.assert_not_called()
        record_analytic.assert_not_called()
        send_nudge.assert_not_called()
        assert call("success.post") not in capture_metric.call_args_list

    def test_cannot_unlink_user_in_another_organization(self) -> None:
        other_user = self.create_user()
        other_organization = self.create_organization(owner=other_user)
        self.create_organization_integration(
            organization_id=other_organization.id, integration=self.integration
        )
        self.login_as(other_user)

        response = self.client.post(self.unlinking_url)

        assert response.status_code == 404
        assert Identity.objects.filter(idp=self.idp, user=self.user).exists()
        self.mock_webhook.assert_not_called()
        self.mock_post.assert_not_called()

    def test_no_identity(self) -> None:
        url = build_unlinking_url(
            self.integration.id, "missing-slack-id", self.channel_id, self.response_url
        )

        response = self.client.post(url)

        assert response.status_code == 404
        assert Identity.objects.filter(idp=self.idp, user=self.user).exists()
        self.mock_webhook.assert_not_called()
        self.mock_post.assert_not_called()

    def test_replayed_unlink(self) -> None:
        assert self.client.post(self.unlinking_url).status_code == 200
        self.mock_webhook.reset_mock()

        response = self.client.post(self.unlinking_url)

        assert response.status_code == 404
        self.mock_webhook.assert_not_called()
        self.mock_post.assert_not_called()

    def test_preserves_identity_for_another_provider(self) -> None:
        other_idp = self.create_identity_provider(type="slack", external_id="other-workspace")
        other_identity = self.create_identity(self.user, other_idp, self.external_id)

        response = self.client.post(self.unlinking_url)

        assert response.status_code == 200
        assert not Identity.objects.filter(idp=self.idp, user=self.user).exists()
        assert Identity.objects.filter(id=other_identity.id).exists()
