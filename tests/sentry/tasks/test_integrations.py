from __future__ import absolute_import, print_function

from time import time

from sentry.models import Integration, Identity, IdentityProvider
from sentry.testutils import TestCase
from sentry.tasks.integrations import kickoff_vsts_subscription_check

import responses


class VstsSubscriptionCheckTest(TestCase):
    def setUp(self):
        responses.add(
            responses.GET,
            "https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription1",
            json={"status": "disabledBySystem"},
        )
        responses.add(
            responses.DELETE,
            "https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription1",
            json={},
        )
        responses.add(
            responses.POST,
            "https://vsts1.visualstudio.com/_apis/hooks/subscriptions",
            json={"id": "subscription1_new_id"},
        )
        responses.add(
            responses.GET,
            "https://vsts1.visualstudio.com/_apis/hooks/subscriptions/subscription3",
            json={"status": "enabled"},
        )
        self.identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="vsts", config={}),
            user=self.user,
            external_id="user_identity",
            data={"access_token": "vsts-access-token", "expires": time() + 50000},
        )

    def assert_subscription(self, subscription_data, subscription_id):
        assert subscription_data["id"] == subscription_id
        assert subscription_data["check"]
        assert subscription_data["secret"]

    @responses.activate
    def test_kickoff_subscription(self):
        integration3_check_time = time()
        integration1 = Integration.objects.create(
            provider="vsts",
            name="vsts1",
            external_id="vsts1",
            metadata={
                "domain_name": "https://vsts1.visualstudio.com/",
                "subscription": {"id": "subscription1"},
            },
        )
        integration1.add_organization(self.organization, default_auth_id=self.identity.id)
        integration2 = Integration.objects.create(
            provider="vsts", name="vsts2", external_id="vsts2", metadata={}
        )
        integration2.add_organization(self.organization, default_auth_id=self.identity.id)
        integration3 = Integration.objects.create(
            provider="vsts",
            name="vsts3",
            external_id="vsts3",
            metadata={
                "subscription": {
                    "id": "subscription3",
                    "check": integration3_check_time,
                    "secret": "1234567890",
                }
            },
        )
        integration3.add_organization(self.organization, default_auth_id=self.identity.id)

        with self.tasks():
            kickoff_vsts_subscription_check()

        subscription1 = Integration.objects.get(provider="vsts", external_id="vsts1").metadata[
            "subscription"
        ]
        self.assert_subscription(subscription1, "subscription1_new_id")

        subscription3 = Integration.objects.get(provider="vsts", external_id="vsts3").metadata[
            "subscription"
        ]
        self.assert_subscription(subscription3, "subscription3")
        assert integration3_check_time == subscription3["check"]
