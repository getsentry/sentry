from datetime import date
from unittest.mock import patch

from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken
from sentry.sentry_apps.installations import (
    SentryAppInstallationCreator,
    SentryAppInstallationTokenCreator,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class TestCreatorBase(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_project(organization=self.org)


@control_silo_test
class TestCreatorInternal(TestCreatorBase):
    def setUp(self):
        super().setUp()

        # will create the installation and the first token
        self.sentry_app = self.create_internal_integration(
            name="internal_app", organization=self.org
        )

        self.sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)

    @patch("sentry.utils.audit.create_audit_entry")
    @patch("sentry.analytics.record")
    def test_create_token_without_audit_or_date(self, record, create_audit_entry):
        request = self.make_request(user=self.user, method="GET")
        api_token = SentryAppInstallationTokenCreator(
            sentry_app_installation=self.sentry_app_installation
        ).run(user=self.user, request=request)

        # verify token was created properly
        assert api_token.expires_at is None

        # check we have two tokens
        sentry_app_installation_tokens = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation
        )

        assert len(sentry_app_installation_tokens) == 2

        assert not create_audit_entry.called

        record.assert_called_with(
            "sentry_app_installation_token.created",
            user_id=self.user.id,
            organization_id=self.org.id,
            sentry_app_installation_id=self.sentry_app_installation.id,
            sentry_app=self.sentry_app.slug,
        )


@control_silo_test
class TestCreatorExternal(TestCreatorBase):
    def setUp(self):
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            name="external_app", organization=self.org, scopes=("org:read", "team:read")
        )

        self.sentry_app_installation = SentryAppInstallationCreator(
            slug=self.sentry_app.slug, organization_id=self.org.id
        ).run(user=self.user, request=None)

    def test_create_token(self):
        today = date.today()
        api_token = SentryAppInstallationTokenCreator(
            sentry_app_installation=self.sentry_app_installation, expires_at=today
        ).run(user=self.user, request=None)

        # verify token was created properly
        assert api_token.expires_at == today
        assert api_token.scope_list == ["org:read", "team:read"]
