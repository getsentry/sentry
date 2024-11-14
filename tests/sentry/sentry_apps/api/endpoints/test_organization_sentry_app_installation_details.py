from unittest.mock import patch

import responses
from django.urls import reverse

from sentry import audit_log
from sentry.constants import SentryAppInstallationStatus
from sentry.models.auditlogentry import AuditLogEntry
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.services.user.service import user_service
from sentry.utils import json


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

        self.orm_installation = self.create_sentry_app_installation(
            slug=self.published_app.slug,
            organization=self.super_org,
            user=self.superuser,
            status=SentryAppInstallationStatus.PENDING,
            prevent_token_exchange=True,
        )
        self.installation = app_service.get_many(
            filter=dict(installation_ids=[self.orm_installation.id])
        )[0]

        self.unpublished_app = self.create_sentry_app(name="Testin", organization=self.org)

        self.orm_installation2 = self.create_sentry_app_installation(
            slug=self.unpublished_app.slug,
            organization=self.org,
            user=self.user,
            status=SentryAppInstallationStatus.PENDING,
            prevent_token_exchange=True,
        )
        self.installation2 = app_service.get_many(
            filter=dict(installation_ids=[self.orm_installation2.id])
        )[0]

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation2.uuid]
        )


@control_silo_test
class GetSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    def test_access_within_installs_organization_by_member(self):
        member_user = self.create_user("member@example.com")
        self.create_member(organization=self.org, user=member_user, role="member")
        self.login_as(member_user)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "app": {"uuid": self.unpublished_app.uuid, "slug": self.unpublished_app.slug},
            "organization": {"slug": self.org.slug, "id": self.org.id},
            "uuid": self.installation2.uuid,
            "status": "pending",
        }

    def test_access_within_installs_organization_by_manager(self):
        manager_user = self.create_user("manager@example.com")
        self.create_member(organization=self.org, user=manager_user, role="manager")
        self.login_as(manager_user)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "app": {"uuid": self.unpublished_app.uuid, "slug": self.unpublished_app.slug},
            "organization": {"slug": self.org.slug, "id": self.org.id},
            "uuid": self.installation2.uuid,
            "code": self.orm_installation2.api_grant.code,
            "status": "pending",
        }

    def test_no_access_outside_install_organization(self):
        self.login_as(user=self.user)

        url = reverse("sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid])

        response = self.client.get(url, format="json")
        assert response.status_code == 404


@control_silo_test
class DeleteSentryAppInstallationDetailsTest(SentryAppInstallationDetailsTest):
    @responses.activate
    @patch("sentry.analytics.record")
    def test_delete_install(self, record):
        responses.add(url="https://example.com/webhook", method=responses.POST, body=b"")
        self.login_as(user=self.user)
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user, "User should exist in test to delete sentry app installation unless noted"

        response = self.client.delete(self.url, format="json")
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_UNINSTALL")
        ).exists()
        record.assert_called_with(
            "sentry_app.uninstalled",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app=self.orm_installation2.sentry_app.slug,
        )

        response_body = json.loads(responses.calls[0].request.body)

        assert response_body.get("installation").get("uuid") == self.orm_installation2.uuid
        assert response_body.get("action") == "deleted"
        assert response_body.get("actor")["id"] == rpc_user.id

        assert response.status_code == 204

    def test_member_cannot_delete_install(self):
        user = self.create_user("bar@example.com")
        self.create_member(organization=self.org, user=user, role="member")
        self.login_as(user)
        response = self.client.delete(self.url, format="json")

        assert response.status_code == 403


@control_silo_test
class MarkInstalledSentryAppInstallationsTest(SentryAppInstallationDetailsTest):
    def setUp(self):
        super().setUp()
        self.token = GrantExchanger(
            install=self.installation,
            code=self.orm_installation.api_grant.code,
            client_id=self.published_app.application.client_id,
            user=self.published_app.proxy_user,
        ).run()

    @patch("sentry.analytics.record")
    def test_sentry_app_installation_mark_installed(self, record):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "installed"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="json",
        )
        assert response.status_code == 200
        assert response.data["status"] == "installed"

        record.assert_called_with(
            "sentry_app_installation.updated",
            sentry_app_installation_id=self.installation.id,
            sentry_app_id=self.orm_installation.sentry_app.id,
            organization_id=self.installation.organization_id,
        )
        self.orm_installation.refresh_from_db()
        assert self.orm_installation.status == SentryAppInstallationStatus.INSTALLED

    def test_sentry_app_installation_mark_pending_status(self):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "pending"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="json",
        )
        assert response.status_code == 400
        assert (
            response.data["status"][0]
            == "Invalid value 'pending' for status. Valid values: 'installed'"
        )

    def test_sentry_app_installation_mark_installed_wrong_app(self):
        self.token = GrantExchanger(
            install=self.installation2,
            code=self.orm_installation2.api_grant.code,
            client_id=self.unpublished_app.application.client_id,
            user=self.unpublished_app.proxy_user,
        ).run()
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )
        response = self.client.put(
            self.url,
            data={"status": "installed"},
            HTTP_AUTHORIZATION=f"Bearer {self.token.token}",
            format="json",
        )
        assert response.status_code == 403

    def test_sentry_app_installation_mark_installed_no_token(self):
        self.url = reverse(
            "sentry-api-0-sentry-app-installation-details", args=[self.installation.uuid]
        )

        response = self.client.put(self.url, data={"status": "installed"}, format="json")

        assert response.status_code == 401
