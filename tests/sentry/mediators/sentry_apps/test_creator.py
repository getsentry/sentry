from __future__ import absolute_import

from mock import patch

from sentry.mediators.sentry_apps import Creator
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    ApiApplication,
    IntegrationFeature,
    SentryApp,
    SentryAppComponent,
    User
)
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.creator = Creator(
            name='nulldb',
            user=self.user,
            author='Sentry',
            organization=self.org,
            scopes=('project:read',),
            webhook_url='http://example.com',
            schema={'elements': [self.create_issue_link_schema()]},
        )

    def test_creates_proxy_user(self):
        self.creator.call()

        assert User.objects.get(
            username='nulldb',
            is_sentry_app=True,
        )

    def test_creates_api_application(self):
        self.creator.call()
        proxy = User.objects.get(username='nulldb')

        assert ApiApplication.objects.get(owner=proxy)

    def test_creates_sentry_app(self):
        self.creator.call()

        proxy = User.objects.get(username='nulldb')
        app = ApiApplication.objects.get(owner=proxy)

        sentry_app = SentryApp.objects.get(
            name='nulldb',
            application=app,
            owner=self.org,
            proxy_user=proxy,
        )

        assert sentry_app
        assert sentry_app.scope_list == ['project:read']

    def test_expands_rolled_up_events(self):
        self.creator.events = ['issue']
        app = self.creator.call()

        sentry_app = SentryApp.objects.get(id=app.id)

        assert 'issue.created' in sentry_app.events

    def test_creates_ui_components(self):
        self.creator.schema = {
            'elements': [
                self.create_issue_link_schema(),
                self.create_alert_rule_action_schema(),
            ],
        }

        app = self.creator.call()

        assert SentryAppComponent.objects.filter(
            sentry_app_id=app.id,
            type='issue-link',
        ).exists()

        assert SentryAppComponent.objects.filter(
            sentry_app_id=app.id,
            type='alert-rule-action',
        ).exists()

    def test_creates_integration_feature(self):
        app = self.creator.call()
        assert IntegrationFeature.objects.filter(sentry_app=app).exists()

    def test_creates_audit_log_entry(self):
        request = self.make_request(user=self.user, method='GET')
        Creator.run(
            name='nulldb',
            user=self.user,
            author='Sentry',
            organization=self.org,
            scopes=('project:read',),
            webhook_url='http://example.com',
            schema={'elements': [self.create_issue_link_schema()]},
            request=request,
        )
        assert AuditLogEntry.objects.filter(event=AuditLogEntryEvent.SENTRY_APP_ADD).exists()

    def test_blank_schema(self):
        self.creator.schema = ''
        assert self.creator.call()

    def test_none_schema(self):
        self.creator.schema = None
        assert self.creator.call()

    def test_schema_with_no_elements(self):
        self.creator.schema = {'elements': []}
        assert self.creator.call()

    @patch('sentry.analytics.record')
    def test_records_analytics(self, record):
        sentry_app = Creator.run(
            name='nulldb',
            user=self.user,
            author='Sentry',
            organization=self.org,
            scopes=('project:read',),
            webhook_url='http://example.com',
            schema={'elements': [self.create_issue_link_schema()]},
            request=self.make_request(user=self.user, method='GET')
        )

        record.assert_called_with(
            'sentry_app.created',
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app=sentry_app.slug,
        )
