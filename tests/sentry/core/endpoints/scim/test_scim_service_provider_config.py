from django.urls import reverse

from sentry.core.endpoints.scim.constants import SCIM_API_ERROR
from sentry.models.authprovider import AuthProvider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, SCIMAzureTestCase, SCIMTestCase
from sentry.testutils.silo import assume_test_silo_mode


class SCIMServiceProviderConfigTest(SCIMTestCase):
    endpoint = "sentry-api-0-organization-scim-service-provider-config"

    def test_200s_with_expected_payload(self) -> None:
        response = self.get_success_response(self.organization.slug)
        location = response.data["meta"]["location"]
        assert location.endswith(
            f"/api/0/organizations/{self.organization.slug}/scim/v2/ServiceProviderConfig"
        )
        assert response.data == {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
            "documentationUri": "https://docs.sentry.io/organization/authentication/sso/",
            "patch": {"supported": True},
            "bulk": {"supported": False, "maxOperations": 0, "maxPayloadSize": 0},
            "filter": {"supported": True, "maxResults": 100},
            "changePassword": {"supported": False},
            "sort": {"supported": False},
            "etag": {"supported": False},
            "authenticationSchemes": [
                {
                    "type": "oauthbearertoken",
                    "name": "OAuth Bearer Token",
                    "description": "Authentication scheme using the OAuth Bearer Token standard. Use the SCIM token generated for your organization.",
                    "specUri": "https://www.rfc-editor.org/info/rfc6750",
                    "primary": True,
                }
            ],
            "meta": {"resourceType": "ServiceProviderConfig", "location": location},
        }
        # single resource, not a ListResponse, and no id (RFC 7643 §5)
        assert "Resources" not in response.data
        assert "totalResults" not in response.data
        assert "id" not in response.data

    def test_200s_with_numeric_org_id(self) -> None:
        response = self.get_success_response(self.organization.id)
        assert response.data["meta"]["location"].endswith(
            f"/api/0/organizations/{self.organization.slug}/scim/v2/ServiceProviderConfig"
        )

    def test_filter_param_rejected(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            qs_params={"filter": 'userName eq "test.user@okta.local"'},
            status_code=403,
        )
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "403",
            "detail": "Filtering is not supported on this endpoint.",
        }

    def test_unparsable_filter_param_also_rejected_with_403(self) -> None:
        response = self.get_error_response(
            self.organization.slug, qs_params={"filter": "%%%"}, status_code=403
        )
        assert response.data["schemas"] == [SCIM_API_ERROR]
        assert response.data["status"] == "403"

    def test_post_not_allowed_with_scim_error_body(self) -> None:
        response = self.get_error_response(self.organization.slug, method="post", status_code=405)
        assert response.data == {
            "schemas": [SCIM_API_ERROR],
            "status": "405",
            "detail": 'Method "POST" not allowed.',
        }

    def test_accepts_scim_json_accept_header(self) -> None:
        url = reverse(self.endpoint, args=[self.organization.slug])
        response = self.client.get(url, HTTP_ACCEPT="application/scim+json")
        assert response.status_code == 200
        assert response["Content-Type"].startswith("application/json")


class SCIMServiceProviderConfigAzureTest(SCIMAzureTestCase):
    endpoint = "sentry-api-0-organization-scim-service-provider-config"

    def test_200s(self) -> None:
        self.get_success_response(self.organization.slug)


class SCIMServiceProviderConfigPermissionsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-scim-service-provider-config",
            args=[self.organization.slug],
        )

    def test_cant_use_scim(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 403

    def test_cant_use_scim_even_with_authprovider(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            AuthProvider.objects.create(organization_id=self.organization.id, provider="dummy")
        response = self.client.get(self.url)
        assert response.status_code == 403

    def test_filter_param_does_not_bypass_permission_check(self) -> None:
        # the scim_enabled check (in convert_args) must run before the
        # discovery filter rejection, so a SCIM-disabled org never sees
        # the SCIM-format filter error
        response = self.client.get(self.url, {"filter": 'userName eq "test"'})
        assert response.status_code == 403
        assert "schemas" not in response.data
