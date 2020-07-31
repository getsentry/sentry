from __future__ import absolute_import

# import responses
import time

from sentry.models import (
    Integration,
    OrganizationIntegration,
    Identity,
    IdentityProvider,
    IdentityStatus,
)

#    Group,
from sentry.testutils import APITestCase

# from sentry.utils import json


class BaseEventTest(APITestCase):
    def setUp(self):
        super(BaseEventTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org, members=[self.user])

        self.integration = Integration.objects.create(
            provider="msteams",
            name="Fellowship of the Ring",
            external_id="f3ll0wsh1p",
            metadata={
                "service_url": "https://smba.trafficmanager.net/amer",
                "access_token": "y0u_5h4ll_n07_p455",
                "expires_at": int(time.time()) + 86400,
            },
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

        self.idp = IdentityProvider.objects.create(
            type="msteams", external_id="y0u_5h4ll_n07_p455", config={}
        )
        self.identity = Identity.objects.create(
            external_id="g4nd4lf",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        self.project1 = self.create_project(organization=self.org)
        self.group1 = self.create_group(project=self.project1)

    def post_webhook(
        self,
        action_type,
        user_id="g4nd4lf",
        team_id="f3ll0wsh1p",
        tenant_id="m17hr4nd1r",
        group_id=None,
        resolve_input=None,
        ignore_input=None,
        assign_input=None,
    ):
        payload = {
            "from": {"id": user_id},
            "channel_data": {"team": {"id": team_id}, "tenant": {"id": tenant_id}},
            "value": {
                "groupId": group_id or self.group1.id,
                "actionType": action_type,
                "resolveInput": resolve_input,
                "ignoreInput": ignore_input,
                "assignInput": assign_input,
            },
        }

        return self.client.post("/extensions/msteams/webhook/", data=payload)
