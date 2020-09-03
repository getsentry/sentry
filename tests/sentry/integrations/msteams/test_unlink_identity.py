from __future__ import absolute_import

import responses
import time

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import TestCase
from sentry.integrations.msteams.unlink_identity import build_unlinking_url
from sentry.utils.signing import unsign


class MsTeamsIntegrationUnlinkIdentityTest(TestCase):
    def setUp(self):
        super(TestCase, self).setUp()
        self.user1 = self.create_user(is_superuser=False)
        self.user2 = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org, members=[self.user1, self.user2])

        self.login_as(self.user1)

        self.integration = Integration.objects.create(
            provider="msteams",
            name="Hogwarts",
            external_id="1_50l3mnly_5w34r",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "3ld3rw4nd",
                "expires_at": int(time.time()) + 86400,
            },
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

        self.idp = IdentityProvider.objects.create(
            type="msteams", external_id="1_50l3mnly_5w34r", config={}
        )
        self.conversation_id = "my_conversation_id"

        access_json = {"expires_in": 86399, "access_token": "3ld3rw4nd"}
        responses.add(
            responses.POST,
            u"https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json=access_json,
        )

        responses.add(
            method=responses.POST,
            url=u"https://smba.trafficmanager.net/amer/v3/conversations/{}/activities".format(
                self.conversation_id
            ),
            status=200,
            json={},
        )

    @responses.activate
    def test_basic_flow(self):
        teams_user_id = "my-teams-user-id"
        Identity.objects.create(
            user=self.user1, idp=self.idp, external_id=teams_user_id, status=IdentityStatus.VALID
        )

        unlink_url = build_unlinking_url(
            self.conversation_id, "https://smba.trafficmanager.net/amer", teams_user_id
        )

        signed_params = unlink_url.split("/")[-2]
        params = unsign(signed_params)
        assert params == {
            "conversation_id": self.conversation_id,
            "service_url": "https://smba.trafficmanager.net/amer",
            "teams_user_id": teams_user_id,
        }

        resp = self.client.get(unlink_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/msteams-unlink-identity.html")

        # Unlink identity of user
        resp = self.client.post(unlink_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/msteams-unlinked.html")

        identity = Identity.objects.filter(external_id=teams_user_id, user=self.user1)

        assert len(identity) == 0
        assert "Your Microsoft Teams identity has been unlinked to your Sentry account." in responses.calls[
            1
        ].request.body.decode(
            "utf-8"
        )
        assert len(responses.calls) == 2

    def test_no_identity(self):
        teams_user_id = "my-teams-user-id"
        # identity for a different user
        Identity.objects.create(
            user=self.user2, idp=self.idp, external_id=teams_user_id, status=IdentityStatus.VALID
        )

        unlink_url = build_unlinking_url(
            self.conversation_id, "https://smba.trafficmanager.net/amer", teams_user_id
        )

        resp = self.client.get(unlink_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/msteams-unlink-identity.html")

        # Unlink identity of user
        resp = self.client.post(unlink_url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/msteams-no-identity.html")

        identity = Identity.objects.filter(external_id=teams_user_id, user=self.user2)

        assert len(identity) == 1
        assert len(responses.calls) == 0
