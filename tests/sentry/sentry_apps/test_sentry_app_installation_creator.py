from unittest.mock import patch

import responses

from sentry import audit_log
from sentry.constants import SentryAppInstallationStatus
from sentry.models.apigrant import ApiGrant
from sentry.models.auditlogentry import AuditLogEntry
from sentry.sentry_apps.installations import SentryAppInstallationCreator
from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import json


@control_silo_test
class TestCreator(TestCase):
    def setUp(self):

        self.user = self.create_user()
        self.org = self.create_organization()

        self.project1 = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="nulldb",
            organization_id=self.org.id,
            scopes=("project:read",),
            events=("issue.created",),
        )

    def run_creator(self, **kwargs):
        return SentryAppInstallationCreator(
            organization_id=self.org.id, slug="nulldb", **kwargs
        ).run(user=self.user, request=kwargs.pop("request", None))

    @responses.activate
    def test_creates_installation(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()
        assert install.pk

    @responses.activate
    def test_creates_installation__multiple_runs(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()
        assert install.pk

        install2 = self.run_creator()
        assert install2.pk != install.pk

    @responses.activate
    def test_creates_api_grant(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()
        assert ApiGrant.objects.filter(id=install.api_grant_id).exists()

    @responses.activate
    def test_creates_service_hooks(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()

        with assume_test_silo_mode(SiloMode.REGION):
            hook = ServiceHook.objects.get(organization_id=self.org.id)

        assert hook.application_id == self.sentry_app.application.id
        assert hook.actor_id == install.id
        assert hook.organization_id == self.org.id
        assert hook.events == self.sentry_app.events
        assert hook.url == self.sentry_app.webhook_url

        with assume_test_silo_mode(SiloMode.REGION):
            assert not ServiceHookProject.objects.all()

    @responses.activate
    def test_creates_audit_log_entry(self):
        responses.add(responses.POST, "https://example.com/webhook")
        request = self.make_request(user=self.user, method="GET")
        SentryAppInstallationCreator(organization_id=self.org.id, slug="nulldb").run(
            user=self.user, request=request
        )
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("SENTRY_APP_INSTALL")
        ).exists()

    @responses.activate
    def test_notifies_service(self):

        rpc_user = user_service.get_user(user_id=self.user.id)
        with self.tasks():
            responses.add(responses.POST, "https://example.com/webhook")
            install = self.run_creator()
            response_body = json.loads(responses.calls[0].request.body)

            assert response_body.get("installation").get("uuid") == install.uuid
            assert response_body.get("action") == "created"
            assert rpc_user, "User should exist, unless explicitly noted in test"
            assert response_body.get("actor").get("id") == rpc_user.id

    @responses.activate
    def test_associations(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()

        assert install.api_grant is not None

    @responses.activate
    def test_pending_status(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()

        assert install.status == SentryAppInstallationStatus.PENDING

    @responses.activate
    def test_installed_status(self):
        responses.add(responses.POST, "https://example.com/webhook")
        internal_app = self.create_internal_integration(name="internal", organization=self.org)
        install = SentryAppInstallationCreator(
            organization_id=self.org.id, slug=internal_app.slug
        ).run(user=self.user, request=None)

        assert install.status == SentryAppInstallationStatus.INSTALLED

    @responses.activate
    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        SentryAppInstallationCreator(
            organization_id=self.org.id,
            slug="nulldb",
        ).run(
            user=self.user,
            request=self.make_request(user=self.user, method="GET"),
        )

        record.assert_called_with(
            "sentry_app.installed",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app="nulldb",
        )

    @responses.activate
    def test_placeholder_email(self):
        responses.add(responses.POST, "https://example.com/webhook")
        install = self.run_creator()
        proxy_user = User.objects.get(id=install.sentry_app.proxy_user.id)
        assert proxy_user.email == f"{proxy_user.id}@proxy-user.sentry.io"
