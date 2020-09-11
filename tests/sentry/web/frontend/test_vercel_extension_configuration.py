from __future__ import absolute_import

import responses
from six.moves.urllib.parse import parse_qs

from sentry.testutils import TestCase
from sentry.models import OrganizationMember


class VercelExtensionConfigurationTest(TestCase):
    @property
    def path(self):
        return u"/extensions/vercel/configure/"

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
            responses.POST, "https://api.vercel.com/v2/oauth/access_token", json=access_json
        )

        responses.add(
            responses.GET,
            "https://api.vercel.com/www/user",
            json={"user": {"name": "my_user_name"}},
        )

        responses.add(
            responses.GET,
            "https://api.vercel.com/v4/projects/",
            json={"projects": [], "pagination": {"count": 0}},
        )

        responses.add(
            responses.POST,
            "https://api.vercel.com/v1/integrations/webhooks",
            json={"id": "webhook-id"},
        )

        self.params = {
            "configurationId": "config_id",
            "code": "my-code",
            "next": "https://example.com",
        }

    @responses.activate
    def test_logged_in_one_org(self):
        self.login_as(self.user)

        resp = self.client.get(self.path, self.params)

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["code"] == ["my-code"]

        # Goes straight to Vercel OAuth
        assert resp.status_code == 302

    def test_logged_no_(self):
        OrganizationMember.objects.filter(user=self.user, organization=self.org).update(
            role="member"
        )
        self.login_as(self.user)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert "/extensions/vercel/link/" in resp.url

    def test_logged_in_many_orgs(self):
        self.login_as(self.user)

        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org)

        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert "/extensions/vercel/link/" in resp.url

    @responses.activate
    def test_choose_org(self):
        self.login_as(self.user)

        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org)
        self.params["orgSlug"] = org.slug

        resp = self.client.get(self.path, self.params)
        # Goes straight to Vercel OAuth
        assert resp.status_code == 302

    def test_logged_out(self):
        resp = self.client.get(self.path, self.params)

        assert resp.status_code == 302
        assert "/auth/login/" in resp.url
        # URL encoded post-login redirect URL=
        assert (
            "next=%2Fextensions%2Fvercel%2Fconfigure%2F%3FconfigurationId%3Dconfig_id%26code%3Dmy-code%26next%3Dhttps%253A%252F%252Fexample.com"
            in resp.url
        )
