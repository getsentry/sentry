from __future__ import absolute_import

from mock import patch
from datetime import date

from sentry.mediators.sentry_app_installation_tokens import Creator
from sentry.models import (
    AuditLogEntry,
    SentryAppInstallationToken,
    SentryAppInstallation
)
from sentry.testutils import TestCase


class TestCreator(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_project(organization=self.org)

        # will create the installation and the first token
        self.sentry_app = self.create_internal_integration(
            name='nulldb',
            organization=self.org
        )

        self.sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)

    @patch('sentry.analytics.record')
    def test_create_token_with_audit(self, record):
        today = date.today()
        request = self.make_request(user=self.user, method='GET')
        sentry_app_installation_token = Creator.run(
            sentry_app_installation=self.sentry_app_installation,
            expires_at=today,
            user=self.user,
            generate_audit=True,
            request=request
        )

        # verify token was created properly
        assert sentry_app_installation_token.api_token.expires_at == today

        # check we have two tokens
        sentry_app_installation_tokens = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation)

        assert len(sentry_app_installation_tokens) == 2

        log = AuditLogEntry.objects.get(organization=self.org)
        assert log.get_note() == 'created a token for internal integration nulldb'
        assert log.organization == self.org
        assert log.target_object == sentry_app_installation_token.id

        record.assert_called_with(
            'sentry_app_installation_token.created',
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )

    @patch('sentry.utils.audit.create_audit_entry')
    @patch('sentry.analytics.record')
    def test_create_token_without_audit_or_date(self, record, create_audit_entry):
        request = self.make_request(user=self.user, method='GET')
        sentry_app_installation_token = Creator.run(
            sentry_app_installation=self.sentry_app_installation,
            user=self.user,
            request=request
        )

        # verify token was created properly
        assert sentry_app_installation_token.api_token.expires_at is None

        # check we have two tokens
        sentry_app_installation_tokens = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation)

        assert len(sentry_app_installation_tokens) == 2

        assert not create_audit_entry.called

        record.assert_called_with(
            'sentry_app_installation_token.created',
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )
