from typing import int
from unittest.mock import MagicMock, patch

from django.db import IntegrityError

from sentry import audit_log
from sentry.analytics.events.internal_integration_created import InternalIntegrationCreatedEvent
from sentry.analytics.events.sentry_app_created import SentryAppCreatedEvent
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.apiapplication import ApiApplication
from sentry.models.auditlogentry import AuditLogEntry
from sentry.sentry_apps.logic import SentryAppCreator
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.testutils.asserts import assert_count_of_metric, assert_success_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User


@control_silo_test
class TestCreator(TestCase):
    def setUp(self) -> None:
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

    def test_slug(self) -> None:
        app = self.creator.run(user=self.user)
        assert app.slug == "nulldb"

    def test_default_popularity(self) -> None:
        app = self.creator.run(user=self.user)
        assert app.popularity == SentryApp._meta.get_field("popularity").default

    def test_popularity(self) -> None:
        popularity = 27
        self.creator.popularity = popularity
        app = self.creator.run(user=self.user)
        assert app.popularity == popularity

    def test_creates_proxy_user(self) -> None:
        self.creator.run(user=self.user)

        assert User.objects.get(username__contains="nulldb", is_sentry_app=True)

    def test_creates_api_application(self) -> None:
        self.creator.run(user=self.user)
        proxy = User.objects.get(username__contains="nulldb")

        assert ApiApplication.objects.get(owner=proxy)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_creates_sentry_app(self, mock_record: MagicMock) -> None:
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

        # SLO assertions
        assert_success_metric(mock_record=mock_record)

        # CREATE (success)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.SUCCESS, outcome_count=1
        )

    def test_creator_label_no_email(self) -> None:
        self.user.email = ""
        self.user.save()
        sentry_app = self.creator.run(user=self.user)

        assert sentry_app.creator_user == self.user
        assert sentry_app.creator_label == "scuba_steve"

    def test_expands_rolled_up_events(self) -> None:
        self.creator.events = ["issue"]
        app = self.creator.run(user=self.user)

        sentry_app = SentryApp.objects.get(id=app.id)

        assert "issue.created" in sentry_app.events

    def test_creates_ui_components(self) -> None:
        self.creator.schema = {
            "elements": [self.create_issue_link_schema(), self.create_alert_rule_action_schema()]
        }

        app = self.creator.run(user=self.user)

        assert SentryAppComponent.objects.filter(sentry_app_id=app.id, type="issue-link").exists()

        assert SentryAppComponent.objects.filter(
            sentry_app_id=app.id, type="alert-rule-action"
        ).exists()

    def test_creates_integration_feature(self) -> None:
        app = self.creator.run(user=self.user)
        assert IntegrationFeature.objects.filter(
            target_id=app.id, target_type=IntegrationTypes.SENTRY_APP.value
        ).exists()

    @patch("sentry.integrations.models.integration_feature.IntegrationFeature.objects.create")
    def test_raises_error_creating_integration_feature(self, mock_create: MagicMock) -> None:
        mock_create.side_effect = IntegrityError()
        self.creator.run(user=self.user)

    def test_creates_audit_log_entry(self) -> None:
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

    def test_blank_schema(self) -> None:
        self.creator.schema = {}
        assert self.creator.run(user=self.user)

    def test_schema_with_no_elements(self) -> None:
        self.creator.schema = {"elements": []}
        assert self.creator.run(user=self.user)

    @patch("sentry.analytics.record")
    def test_records_analytics(self, record: MagicMock) -> None:
        sentry_app = SentryAppCreator(
            name="nulldb",
            author="Sentry",
            organization_id=self.org.id,
            scopes=["project:read"],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
            is_internal=False,
        ).run(user=self.user, request=self.make_request(user=self.user, method="GET"))

        assert_any_analytics_event(
            record,
            SentryAppCreatedEvent(
                user_id=self.user.id,
                organization_id=self.org.id,
                sentry_app=sentry_app.slug,
                created_alert_rule_ui_component=False,
            ),
        )

    def test_allows_name_that_exists_as_username_already(self) -> None:
        self.create_user(username="nulldb")
        assert self.creator.run(user=self.user)


@control_silo_test
class TestInternalCreator(TestCase):
    def setUp(self) -> None:
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

    def test_slug(self) -> None:
        sentry_app = self.run_creator()
        # test slug is the name + a UUID
        assert sentry_app.slug[:7] == "nulldb-"
        assert len(sentry_app.slug) == 13

    def test_creates_internal_sentry_app(self) -> None:
        sentry_app = self.run_creator()
        assert sentry_app.author == self.org.name
        assert SentryApp.objects.filter(slug=sentry_app.slug).exists()

    def test_installs_to_org(self) -> None:
        sentry_app = self.run_creator()

        assert SentryAppInstallation.objects.filter(
            organization_id=self.org.id, sentry_app=sentry_app
        ).exists()

    def test_author(self) -> None:
        sentry_app = self.run_creator(author="custom")
        assert sentry_app.author == "custom"

    @patch("sentry.sentry_apps.tasks.sentry_apps.installation_webhook.delay")
    def test_does_not_notify_service(self, delay: MagicMock) -> None:
        self.run_creator()
        assert not len(delay.mock_calls)

    def test_creates_access_token(self) -> None:
        sentry_app = self.run_creator()

        install = SentryAppInstallation.objects.get(
            organization_id=self.org.id, sentry_app=sentry_app
        )

        assert install.api_token

    def test_skips_creating_auth_token_when_flag_is_true(self) -> None:
        app = SentryAppCreator(
            is_internal=True,
            verify_install=False,
            author=self.org.name,
            name="nulldb",
            organization_id=self.org.id,
            scopes=[
                "project:read",
            ],
            webhook_url="http://example.com",
            schema={"elements": [self.create_issue_link_schema()]},
        ).run(user=self.user, request=None, skip_default_auth_token=True)

        install = SentryAppInstallation.objects.get(organization_id=self.org.id, sentry_app=app)

        assert install.api_token is None

    @patch("sentry.utils.audit.create_audit_entry")
    def test_audits(self, create_audit_entry: MagicMock) -> None:
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
    def test_records_analytics(self, create_audit_entry: MagicMock, record: MagicMock) -> None:
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

        assert_any_analytics_event(
            record,
            InternalIntegrationCreatedEvent(
                user_id=self.user.id,
                organization_id=self.org.id,
                sentry_app=sentry_app.slug,
            ),
        )
