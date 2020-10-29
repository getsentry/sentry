from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.utils.compat.mock import patch

from sentry.testutils import APITestCase
import responses
from sentry.mediators.token_exchange import GrantExchanger
from sentry.constants import SentryAppInstallationStatus


class SentryAppInstallationDetailsTest(APITestCase):
    def setUp(self):
        self.superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.super_org = self.create_organization(owner=self.superuser)

        self.published_app = self.create_sentry_app(
            name="Test",
            organization=self.super_org,
            published=True,
            scopes=("org:write", "team:admin"),
        )

        self.installation = self.create_sentry_app_installation(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
            status=SentryAppInstallationStatus.PENDING,
        )

        self.unpublished_app = self.create_sentry_app(name="Testin", organization=self.org)

        self.installation2 = self.create_sentry_app_installation(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
            status=SentryAppInstallationStatus.PENDING,
        )

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation2.uuid]
        )


class GetSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    def test_access_within_installs_organization(self):
        self.login_as(user=self.user)
        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "app": {"uuid": self.unpublished_app.uuid, "slug": self.unpublished_app.slug},
            "organization": {"slug": self.org.slug},
            "uuid": self.installation2.uuid,
            "code": self.installation2.api_grant.code,
            "status": "pending",
        }

    def test_no_access_outside_install_organization(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid])

        response = self.client.get(url, format="json")
        assert response.status_code == 404


class DeleteSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    @responses.activate
    def test_delete_install(self):
        responses.add(url="https://example.com/webhook", method=responses.POST, body={})
        self.login_as(user=self.user)
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 204

    def test_member_cannot_delete_install(self):
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.org, user=user, role="member")
        self.login_as(user)
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 403


class MarkInstalledSentryAppInstallationsTest(SentryAppInstallationDetailsTest):
    def setUp(self):
        super(MarkInstalledSentryAppInstallationsTest, self).setUp()
        self.token = GrantExchanger.run(
            install=self.installation,
            code=self.installation.api_grant.code,
            client_id=self.published_app.application.client_id,
            user=self.published_app.proxy_user,
        )

    @patch("sentry.analytics.record")
    def test_sentry_app_installation_mark_installed(self, record):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "installed"},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "installed"

        record.assert_called_with(
            "sentry_app_installation.updated",
            sentry_app_installation_id=self.installation.id,
            sentry_app_id=self.installation.sentry_app.id,
            organization_id=self.installation.organization.id,
        )

    def test_sentry_app_installation_mark_pending_status(self):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "pending"},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            format="json",
        )
        assert response.status_code == 400
        assert (
            response.data["status"][0]
            == u"Invalid value 'pending' for status. Valid values: 'installed'"
        )

    def test_sentry_app_installation_mark_installed_wrong_app(self):
        self.token = GrantExchanger.run(
            install=self.installation2,
            code=self.installation2.api_grant.code,
            client_id=self.unpublished_app.application.client_id,
            user=self.unpublished_app.proxy_user,
        )
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "installed"},
            HTTP_AUTHORIZATION=u"Bearer {}".format(self.token.token),
            format="json",
        )
        assert response.status_code == 403

    def test_sentry_app_installation_mark_installed_no_token(self):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )

        response = self.client.put(self.url, data={"status": "installed"}, format="json")

        assert response.status_code == 401
