from urllib.parse import parse_qsl, urlparse

from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class VstsExtensionConfigurationTest(TestCase):
    @property
    def path(self):
        return reverse("vsts-extension-configuration")

    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        self.create_member(user_id=self.user.id, organization=self.org, role="admin")

    def test_logged_in_one_org(self):
        self.login_as(self.user)

        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        # Goes straight to VSTS OAuth
        assert resp.status_code == 302
        assert resp.headers["Location"].startswith(
            "https://app.vssps.visualstudio.com/oauth2/authorize"
        )

    def test_logged_in_many_orgs(self):
        self.login_as(self.user)

        org = self.create_organization()
        self.create_member(user_id=self.user.id, organization=org)

        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        assert resp.status_code == 302
        assert "/extensions/vsts/link/" in resp.headers["Location"]

    def test_choose_org(self):
        self.login_as(self.user)

        resp = self.client.get(
            self.path, {"targetId": "1", "targetName": "foo", "orgSlug": self.org.slug}
        )

        assert resp.status_code == 302
        assert resp.headers["Location"].startswith(
            "https://app.vssps.visualstudio.com/oauth2/authorize"
        )

    def test_logged_out(self):
        query = {"targetId": "1", "targetName": "foo"}
        resp = self.client.get(self.path, query)

        assert resp.status_code == 302
        assert "/auth/login/" in resp.headers["Location"]

        # Verify URL encoded post-login redirect URL
        next_parts = urlparse(dict(parse_qsl(urlparse(resp.headers["Location"]).query))["next"])

        assert next_parts.path == "/extensions/vsts/configure/"
        assert dict(parse_qsl(next_parts.query)) == query

    @override_settings(SENTRY_FEATURES={})
    def test_goes_to_setup_unregisted_feature(self):
        self.login_as(self.user)

        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        assert resp.status_code == 302
        assert resp.headers["Location"].startswith(
            "https://app.vssps.visualstudio.com/oauth2/authorize"
        )
