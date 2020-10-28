from __future__ import absolute_import

import responses

from sentry.utils.compat.mock import patch

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import TestCase
from sentry.integrations.slack.link_identity import build_linking_url


class SlackIntegrationLinkIdentityTest(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.user1 = self.create_user(is_superuser=False)
        self.user2 = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org, members=[self.user1, self.user2])

        self.login_as(self.user1)

        self.integration = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})

    @responses.activate
    @patch("sentry.integrations.slack.link_identity.unsign")
    def test_basic_flow(self, unsign):
        unsign.return_value = {
            "integration_id": self.integration.id,
            "organization_id": self.org.id,
            "slack_id": "new-slack-id",
            "channel_id": "my-channel",
            "response_url": "http://example.slack.com/response_url",
        }

        linking_url = build_linking_url(
            self.integration,
            self.org,
            "new-slack-id",
            "my-channel",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/auth-link-identity.html")

        responses.add(
            method=responses.POST,
            url="http://example.slack.com/response_url",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Link identity of user
        resp = self.client.post(linking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user1)

        assert len(identity) == 1
        assert identity[0].idp == self.idp
        assert identity[0].status == IdentityStatus.VALID
        assert len(responses.calls) == 1

    @responses.activate
    @patch("sentry.integrations.slack.link_identity.unsign")
    def test_overwrites_existing_identities(self, unsign):
        Identity.objects.create(
            user=self.user1, idp=self.idp, external_id="slack-id1", status=IdentityStatus.VALID
        )
        Identity.objects.create(
            user=self.user2, idp=self.idp, external_id="slack-id2", status=IdentityStatus.VALID
        )

        unsign.return_value = {
            "integration_id": self.integration.id,
            "organization_id": self.org.id,
            "slack_id": "slack-id2",
            "channel_id": "my-channel",
            "response_url": "http://example.slack.com/response_url",
        }

        linking_url = build_linking_url(
            self.integration,
            self.org,
            "slack-id2",
            "my-channel",
            "http://example.slack.com/response_url",
        )
        responses.add(
            method=responses.POST,
            url="http://example.slack.com/response_url",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        self.client.post(linking_url)

        Identity.objects.get(external_id="slack-id2", user=self.user1)
        assert not Identity.objects.filter(external_id="slack-id1", user=self.user1).exists()
        assert not Identity.objects.filter(external_id="slack-id2", user=self.user2).exists()
