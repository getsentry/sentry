from __future__ import absolute_import

import responses

from sentry.models import Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration
from sentry.testutils import TestCase
from sentry.integrations.slack.link_identity import build_linking_url


class SlackIntegrationLinkIdentityTest(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.login_as(self.user)

        self.integration = Integration.objects.create(
            provider='slack',
            external_id='TXXXXXXX1',
            metadata={
                'access_token': 'xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
            }
        )
        OrganizationIntegration.objects.create(
            organization=self.org,
            integration=self.integration,
        )

        self.idp = IdentityProvider.objects.create(
            type='slack',
            organization=self.org,
            config={},
        )

    @responses.activate
    def test_basic_flow(self):
        linking_url = build_linking_url(
            self.integration,
            self.org,
            'new-slack-id',
            'my-channel'
        )

        resp = self.client.get(linking_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/auth-link-identity.html')

        responses.add(
            method=responses.POST,
            url='https://slack.com/api/chat.postEphemeral',
            body='{"ok": true}',
            status=200,
            content_type='application/json',
        )

        # Link identity of user
        resp = self.client.post(linking_url)

        identity = Identity.objects.filter(
            external_id='new-slack-id',
            user=self.user,
        )

        assert len(identity) == 1
        assert identity[0].idp == self.idp
        assert identity[0].status == IdentityStatus.VALID
        assert len(responses.calls) == 1
