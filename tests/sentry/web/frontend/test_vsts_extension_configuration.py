from __future__ import absolute_import

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

        OrganizationMember.objects.create(user=self.user, organization=self.org)

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

        resp = self.client.post(
            self.path, {"vsts_id": "1", "vsts_name": "foo", "organization": self.org.slug}
        )

        assert resp.status_code == 302
        assert resp.url.startswith("https://app.vssps.visualstudio.com/oauth2/authorize")

    def test_logged_out(self):
        resp = self.client.get(self.path, {"targetId": "1", "targetName": "foo"})

        assert resp.status_code == 302
        assert "/auth/login/" in resp.url
        # URL encoded post-login redirect URL
        assert (
            "next=%2Fextensions%2Fvsts%2Fconfigure%2F%3FtargetName%3Dfoo%26targetId%3D1" in resp.url
        )
