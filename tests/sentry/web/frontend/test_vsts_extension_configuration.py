from __future__ import absolute_import

from six.moves.urllib.parse import parse_qsl, urlparse
from django.core.urlresolvers import reverse

from sentry.testutils import TestCase
from sentry.models import OrganizationMember


class VstsExtensionConfigurationTest(TestCase):
    @property
    def path(self):
        return reverse("vsts-extension-configuration")

    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization()

        OrganizationMember.objects.create(user=self.user, organization=self.org, role="admin")

    def test_logged_in_one_org(self):
        self.login_as(self.user)

        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        # Goes straight to VSTS OAuth
        assert resp.status_code == 302
        assert resp.url.startswith("https://app.vssps.visualstudio.com/oauth2/authorize")

    def test_logged_in_many_orgs(self):
        self.login_as(self.user)

        org = self.create_organization()
        OrganizationMember.objects.create(user=self.user, organization=org)

        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        assert resp.status_code == 302
        assert "/extensions/vsts/link/" in resp.url

    def test_choose_org(self):
        self.login_as(self.user)

        resp = self.client.get(
            self.path, {"targetId": "1", "targetName": "foo", "orgSlug": self.org.slug}
        )

        assert resp.status_code == 302
        assert resp.url.startswith("https://app.vssps.visualstudio.com/oauth2/authorize")

    def test_logged_out(self):
        query = {"targetId": "1", "targetName": "foo"}
        resp = self.client.get(self.path, query)

        assert resp.status_code == 302
        assert "/auth/login/" in resp.url

        # Verify URL encoded post-login redirect URL
        next_parts = urlparse(dict(parse_qsl(urlparse(resp.url).query))["next"])

        assert next_parts.path == "/extensions/vsts/configure/"
        assert dict(parse_qsl(next_parts.query)) == query
