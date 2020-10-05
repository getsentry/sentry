from __future__ import absolute_import

import responses

from time import time

from sentry.models import Identity, IdentityProvider, Integration
from sentry.testutils.helpers import with_feature
from .testutils import VstsIntegrationTestCase


class VstsApiClientTest(VstsIntegrationTestCase):
    def test_refreshes_expired_token(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")

        # Make the Identity have an expired token
        idp = IdentityProvider.objects.get(external_id=self.vsts_account_id)
        identity = Identity.objects.get(idp_id=idp.id)
        identity.data["expires"] = int(time()) - int(123456789)
        identity.save()

        # New values VSTS will return on refresh
        self.access_token = "new-access-token"
        self.refresh_token = "new-refresh-token"
        self._stub_vsts()

        # Make a request with expired token
        integration.get_installation(
            integration.organizations.first().id
        ).get_client().get_projects(self.vsts_base_url)

        # Second to last request, before the Projects request, was to refresh
        # the Access Token.
        assert responses.calls[-2].request.url == "https://app.vssps.visualstudio.com/oauth2/token"

        # Then we request the Projects with the new token
        assert responses.calls[-1].request.url == u"{}_apis/projects?stateFilter=WellFormed".format(
            self.vsts_base_url.lower()
        )

        identity = Identity.objects.get(id=identity.id)
        assert identity.scopes == [
            "vso.code",
            "vso.graph",
            "vso.serviceendpoint_manage",
            "vso.work_write",
        ]
        assert identity.data["access_token"] == "new-access-token"
        assert identity.data["refresh_token"] == "new-refresh-token"

    @with_feature("organizations:integrations-vsts-limited-scopes")
    def test_refreshes_expired_token_limited_scopes(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")

        # Make the Identity have an expired token
        idp = IdentityProvider.objects.get(external_id=self.vsts_account_id)
        identity = Identity.objects.get(idp_id=idp.id)
        identity.data["expires"] = int(time()) - int(123456789)
        identity.save()

        # New values VSTS will return on refresh
        self.access_token = "new-access-token"
        self.refresh_token = "new-refresh-token"
        self._stub_vsts()

        # Make a request with expired token
        integration.get_installation(
            integration.organizations.first().id
        ).get_client().get_projects(self.vsts_base_url)

        # Second to last request, before the Projects request, was to refresh
        # the Access Token.
        assert responses.calls[-2].request.url == "https://app.vssps.visualstudio.com/oauth2/token"

        # Then we request the Projects with the new token
        assert responses.calls[-1].request.url == u"{}_apis/projects?stateFilter=WellFormed".format(
            self.vsts_base_url.lower()
        )

        identity = Identity.objects.get(id=identity.id)
        assert identity.scopes == ["vso.graph", "vso.serviceendpoint_manage", "vso.work_write"]
        assert identity.data["access_token"] == "new-access-token"
        assert identity.data["refresh_token"] == "new-refresh-token"
