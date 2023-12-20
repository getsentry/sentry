from unittest.mock import MagicMock, patch

from django.db import IntegrityError

from sentry import audit_log
from sentry.models.apiapplication import ApiApplication
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.sentry_apps.apps import SentryAppCreator
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user(email="foo@bar.com", username="scuba_steve")
        self.org = self.create_organization(owner=self.user)
        self.creator = SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            scopes=["project:read"],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            is_internal=False,
        )

    def test_slug(self):
        app = self.creator.run(user=self.user)
        assert app.slug == "nulldb"

    def test_default_popularity(self):
        app = self.creator.run(user=self.user)
        assert app.popularity == SentryApp._meta.get_field("popularity").default

    def test_popularity(self):
        popularity = 27
        self.creator.popularity = popularity
        app = self.creator.run(user=self.user)
        assert app.popularity == popularity

    def test_creates_proxy_user(self):
        self.creator.run(user=self.user)

        assert User.objects.get(username__contains="nulldb", is_sentry_app=True)

    def test_creates_api_application(self):
        self.creator.run(user=self.user)
        proxy = User.objects.get(username__contains="nulldb")

        assert ApiApplication.objects.get(owner=proxy)

    def test_creates_sentry_app(self):
        self.creator.run(user=self.user)

        proxy = User.objects.get(username__contains="nulldb")
        app = ApiApplication.objects.get(owner=proxy)

        sentry_app = SentryApp.objects.get(
            name="nulldb", application=app, owner_id=self.org.id, proxy_user=proxy
        )

        assert sentry_app
        assert sentry_app.scope_list == ["project:read"]

        assert sentry_app.creator_user == self.user
        assert sentry_app.creator_label == "foo@bar.com"

    def test_creator_label_no_email(self):
        self.user.email = ""
        self.user.save()
        sentry_app = self.creator.run(user=self.user)

        assert sentry_app.creator_user == self.user
        assert sentry_app.creator_label == "scuba_steve"

    def test_expands_rolled_up_events(self):
        self.creator.events = ["issue"]
        app = self.creator.run(user=self.user)

        sentry_app = SentryApp.objects.get(id=app.id)

        assert "issue.created" in sentry_app.events

    def test_creates_ui_components(self):
        self.creator.schema = {
            "elements": [self.create_issue_link_schema(), self.create_alert_rule_action_schema()]
        }

        app = self.creator.run(user=self.user)

        assert SentryAppComponent.objects.filter(sentry_app_id=app.id, type="issue-link").exists()

        assert SentryAppComponent.objects.filter(
            sentry_app_id=app.id, type="alert-rule-action"
        ).exists()

    def test_creates_integration_feature(self):
        app = self.creator.run(user=self.user)
        assert IntegrationFeature.objects.filter(
            target_id=app.id, target_type=IntegrationTypes.SENTRY_APP.value
        ).exists()

    @patch("sentry.models.integrations.integration_feature.IntegrationFeature.objects.create")
    def test_raises_error_creating_integration_feature(self, mock_create):
        mock_create.side_effect = IntegrityError()
        self.creator.run(user=self.user)

    def test_creates_audit_log_entry(self):
        request = self.make_request(user=self.user, method="GET")
        SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            scopes=[
                "project:read",
            ],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            is_internal=False,
        ).run(user=self.user, request=request)
        assert AuditLogEntry.objects.filter(event=audit_log.get_event_id("SENTRY_APP_ADD")).exists()

    def test_blank_schema(self):
        self.creator.schema = {}
        assert self.creator.run(user=self.user)

    def test_schema_with_no_elements(self):
        self.creator.schema = {"elements": []}
        assert self.creator.run(user=self.user)

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record):
        sentry_app = SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            scopes=["project:read"],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            is_internal=False,
        ).run(user=self.user, request=self.make_request(user=self.user, method="GET"))

        record.assert_called_with(
            "sentry_app.created",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app=sentry_app.slug,
            created_alert_rule_ui_component=False,
        )

    def test_allows_name_that_exists_as_username_already(self):
        self.create_user(username="nulldb")
        assert self.creator.run(user=self.user)


class TestInternalCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def run_creator(self, **kwargs):
        return SentryAppCreator(
            is_internal=True,
            verify_install=False,
            author=kwargs.pop("author", self.org.name),
            name="nulldb",
            organization_id=self.org.id,
            scopes=[
                "project:read",
            ],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            **kwargs,
        ).run(user=self.user, request=kwargs.pop("request", None))

    def test_slug(self):
        sentry_app = self.run_creator()
        # test slug is the name + a UUID
        assert sentry_app.slug[:7] == "nulldb-"
        assert len(sentry_app.slug) == 13

    def test_creates_internal_sentry_app(self):
        sentry_app = self.run_creator()
        assert sentry_app.author == self.org.name
        assert SentryApp.objects.filter(slug=sentry_app.slug).exists()

    def test_installs_to_org(self):
        sentry_app = self.run_creator()

        assert SentryAppInstallation.objects.filter(
            organization_id=self.org.id, sentry_app=sentry_app
        ).exists()

    def test_author(self):
        sentry_app = self.run_creator(author="custom")
        assert sentry_app.author == "custom"

    @patch("sentry.tasks.sentry_apps.installation_webhook.delay")
    def test_does_not_notify_service(self, delay):
        self.run_creator()
        assert not len(delay.mock_calls)

    def test_creates_access_token(self):
        sentry_app = self.run_creator()

        install = SentryAppInstallation.objects.get(
            organization_id=self.org.id, sentry_app=sentry_app
        )

        assert install.api_token

    @patch("sentry.utils.audit.create_audit_entry")
    def test_audits(self, create_audit_entry):
        SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            is_internal=True,
            verify_install=False,
            scopes=[
                "project:read",
            ],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
        ).run(user=self.user, request=MagicMock())

        (
            _,
            _,
            (_, kwargs),
        ) = create_audit_entry.call_args_list
        assert kwargs["organization_id"] == self.org.id
        assert kwargs["target_object"] == self.org.id
        assert kwargs["event"] == audit_log.get_event_id("INTERNAL_INTEGRATION_ADD")

    @patch("sentry.analytics.record")
    @patch("sentry.utils.audit.create_audit_entry")
    def test_records_analytics(self, create_audit_entry, record):
        sentry_app = SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            is_internal=True,
            verify_install=False,
            scopes=["project:read"],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
        ).run(user=self.user, request=MagicMock())

        record.assert_called_with(
            "internal_integration.created",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app=sentry_app.slug,
        )
