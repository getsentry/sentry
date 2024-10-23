from urllib.parse import parse_qs, urlparse

import responses
from django.db import router

from sentry.identity.vercel import VercelIdentityProvider
from sentry.integrations.vercel import VercelClient
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class VercelExtensionConfigurationTest(TestCase):
    path = "/extensions/vercel/configure/"

    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationMember.objects.create(
                user_id=self.user.id, organization=self.org, role="admin"
            )

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
        assert resp.headers["Location"].startswith(
            f"http://testserver/settings/{self.org.slug}/integrations/vercel/"
        )
        assert resp.headers["Location"].endswith("?next=https%3A%2F%2Fexample.com")

    @responses.activate
    def test_logged_in_as_member(self):
        with (
            assume_test_silo_mode(SiloMode.REGION),
            unguarded_write(using=router.db_for_write(OrganizationMember)),
        ):
            OrganizationMember.objects.filter(user_id=self.user.id, organization=self.org).update(
                role="member"
            )
        self.login_as(self.user)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert resp.headers["Location"].startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
        }
        parsed_url = urlparse(resp.headers["Location"])
        assert parse_qs(parsed_url.query) == expected_query_string

    @responses.activate
    def test_logged_in_many_orgs(self):
        self.login_as(self.user)

        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationMember.objects.create(user_id=self.user.id, organization=org)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert resp.headers["Location"].startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
        }
        parsed_url = urlparse(resp.headers["Location"])
        assert parse_qs(parsed_url.query) == expected_query_string

    @responses.activate
    def test_choose_org(self):
        self.login_as(self.user)

        org = self.create_organization()
        with assume_test_silo_mode(SiloMode.REGION):
            OrganizationMember.objects.create(user_id=self.user.id, organization=org)
        self.params["orgSlug"] = org.slug

        resp = self.client.get(self.path, self.params)
        # Goes straight to Vercel OAuth
        assert resp.status_code == 302
        assert resp.headers["Location"].startswith("/extensions/vercel/link/?")
        expected_query_string = {
            "configurationId": ["config_id"],
            "code": ["my-code"],
            "next": ["https://example.com"],
            "orgSlug": [org.slug],
        }
        parsed_url = urlparse(resp.headers["Location"])
        assert parse_qs(parsed_url.query) == expected_query_string

    @responses.activate
    def test_logged_out(self):
        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        # URL encoded post-login redirect URL=
        assert resp.headers["Location"].startswith("/auth/login/?")
        # URL encoded post-login redirect URL=
        assert (
            "next=%2Fextensions%2Fvercel%2Fconfigure%2F%3FconfigurationId%3Dconfig_id%26code%3Dmy-code%26next%3Dhttps%253A%252F%252Fexample.com"
            in resp.headers["Location"]
        )

    @responses.activate
    @with_feature("organizations:integrations-deployment")
    def test_logged_in_one_org_customer_domain(self):
        self.login_as(self.user)

        resp = self.client.get(
            self.path,
            self.params,
            HTTP_HOST=f"{self.org.slug}.testserver",
        )

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["code"] == ["my-code"]

        # Goes straight to Vercel OAuth
        assert resp.status_code == 302
        assert resp.headers["Location"].startswith(
            f"http://{self.org.slug}.testserver/settings/integrations/vercel/"
        )
        assert resp.headers["Location"].endswith("?next=https%3A%2F%2Fexample.com")
