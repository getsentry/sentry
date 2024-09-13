from time import time

import responses

from sentry.integrations.models.integration import Integration
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider

EXTERNAL_ID = "c8a585ae-b61f-4ba6-833c-9e8d5d1674d8"


@control_silo_test
class VstsSearchTest(APITestCase):
    provider = "vsts"
    endpoint = "sentry-extensions-vsts-search"

    def setUp(self):
        super().setUp()

        self.login_as(self.user)
        self.vsts_account_name = "MyVSTSAccount"
        self.integration = Integration.objects.create(
            provider=self.provider,
            name=self.vsts_account_name,
            external_id=EXTERNAL_ID,
            metadata={
                "domain_name": f"https://{self.vsts_account_name}.visualstudio.com/",
                "scopes": [
                    "vso.code",
                    "vso.graph",
                    "vso.serviceendpoint_manage",
                    "vso.work_write",
                ],
                "subscription": {
                    "id": "fd672255-8b6b-4769-9260-beea83d752ce",
                    "secret": "4c811eb7e349755b160dabc4ac0584298e7e9f96d5eb4d221d740ea97cb646dc",
                },
            },
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type=self.provider, config={}),
            user=self.user,
            external_id="vsts123",
            data={
                "access_token": "123456789",
                "created_at": time(),
                "expires": time() + 3600,
                "refresh_token": "0987654321",
            },
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = get_installation_of_type(
            VstsIntegration, self.integration, self.organization.id
        )

    @responses.activate
    def test_search_issues(self):
        responses.add(
            responses.POST,
            f"https://{self.vsts_account_name.lower()}.almsearch.visualstudio.com/_apis/search/workitemsearchresults",
            json={
                "results": [
                    {
                        "id": 309,
                        "rev": 1,
                        "fields": {
                            "system.id": "2",
                            "system.title": "Title",
                        },
                    }
                ]
            },
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.integration.id,
            qs_params={"query": "query", "field": "externalIssue"},
        )

        assert resp.data == [
            {"label": "(2) Title", "value": "2"},
        ]
