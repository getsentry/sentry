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
from sentry.integrations.slack.unlink_identity import build_unlinking_url


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

        Identity.objects.create(
            user=self.user1, idp=self.idp, external_id="new-slack-id", status=IdentityStatus.VALID
        )

        unsign.return_value = {
            "integration_id": self.integration.id,
            "organization_id": self.org.id,
            "slack_id": "new-slack-id",
            "channel_id": "my-channel",
            "response_url": "http://example.slack.com/response_url",
        }

        unlinking_url = build_unlinking_url(
            self.integration.id,
            self.org.id,
            "new-slack-id",
            "my-channel",
            "http://example.slack.com/response_url",
        )

        resp = self.client.get(unlinking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/auth-unlink-identity.html")

        responses.add(
            method=responses.POST,
            url="http://example.slack.com/response_url",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Unlink identity of user
        resp = self.client.post(unlinking_url)

        identity = Identity.objects.filter(external_id="new-slack-id", user=self.user1)

        assert len(identity) == 0
        assert len(responses.calls) == 1
