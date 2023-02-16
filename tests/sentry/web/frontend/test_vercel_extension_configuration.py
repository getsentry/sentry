from urllib.parse import parse_qs, urlparse

import responses

from sentry.identity.vercel import VercelIdentityProvider
from sentry.integrations.vercel import VercelClient
from sentry.models import OrganizationMember
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature


class VercelExtensionConfigurationTest(TestCase):
    path = "/extensions/vercel/configure/"

    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        OrganizationMember.objects.create(user=self.user, organization=self.org, role="admin")

        responses.reset()
        # need oauth mocks
        access_json = {
            "user_id": "my_user_id",
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
        }
        responses.add(
            responses.POST, VercelIdentityProvider.oauth_access_token_url, json=access_json
        )

        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_USER_URL}",
            json={"user": {"name": "my_user_name"}},
        )

        responses.add(
            responses.GET,
            f"{VercelClient.base_url}{VercelClient.GET_PROJECTS_URL}",
            json={"projects": [], "pagination": {"count": 0, "next": None}},
        )

        self.params = {
            "configurationId": "config_id",
            "code": "my-code",
            "next": "https://example.com",
        }

    @responses.activate
    @with_feature("organizations:integrations-deployment")
    def test_logged_in_one_org(self):
        self.login_as(self.user)

        resp = self.client.get(self.path, self.params)

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["code"] == ["my-code"]

        # Goes straight to Vercel OAuth
        assert resp.status_code == 302
        assert resp.url.startswith(
            f"http://testserver/settings/{self.org.slug}/integrations/vercel/"
        )
        assert resp.url.endswith("?next=https%3A%2F%2Fexample.com")

    def test_logged_in_as_member(self):
        OrganizationMember.objects.filter(user=self.user, organization=self.org).update(
            role="member"
        )
        self.login_as(self.user)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert resp.url.startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
        }
        parsed_url = urlparse(resp.url)
        assert parse_qs(parsed_url.query) == expected_query_string

    def test_logged_in_many_orgs(self):
        self.login_as(self.user)

        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert resp.url.startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
        }
        parsed_url = urlparse(resp.url)
        assert parse_qs(parsed_url.query) == expected_query_string

    @responses.activate
    def test_choose_org(self):
        self.login_as(self.user)

        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org)
        self.params["orgSlug"] = org.slug

        resp = self.client.get(self.path, self.params)
        # Goes straight to Vercel OAuth
        assert resp.status_code == 302
        assert resp.url.startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
            "orgSlug": [org.slug],
        }
        parsed_url = urlparse(resp.url)
        assert parse_qs(parsed_url.query) == expected_query_string

    def test_logged_out(self):
        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        # URL encoded post-login redirect URL=
        assert resp.url.startswith("/auth/login/?")
        # URL encoded post-login redirect URL=
        assert (
            "next=%2Fextensions%2Fvercel%2Fconfigure%2F%3FconfigurationId%3Dconfig_id%26code%3Dmy-code%26next%3Dhttps%253A%252F%252Fexample.com"
            in resp.url
        )

    @responses.activate
    @with_feature("organizations:integrations-deployment")
    def test_logged_in_one_org_customer_domain(self):
        self.login_as(self.user)

        resp = self.client.get(
            self.path,
            self.params,
            SERVER_NAME=f"{self.org.slug}.testserver",
        )

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["code"] == ["my-code"]

        # Goes straight to Vercel OAuth
        assert resp.status_code == 302
        assert resp.url.startswith(
            f"http://{self.org.slug}.testserver/settings/integrations/vercel/"
        )
        assert resp.url.endswith("?next=https%3A%2F%2Fexample.com")
