from typing import int
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.analytics.events.sentry_app_installation_token_created import (
    SentryAppInstallationTokenCreated,
)
from sentry.sentry_apps.installations import (
    SentryAppInstallationCreator,
    SentryAppInstallationTokenCreator,
)
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.models.sentry_app_installation_token import SentryAppInstallationToken
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.silo import control_silo_test


class TestCreatorBase(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_project(organization=self.org)


@control_silo_test
class TestCreatorInternal(TestCreatorBase):
    def setUp(self) -> None:
        super().setUp()

        # Create the internal integration (NOTE: This no longer creates an initial token as well)
        self.sentry_app = self.create_internal_integration(
            name="internal_app", organization=self.org
        )

        self.sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=self.sentry_app)

    @patch("sentry.utils.audit.create_audit_entry")
    @patch("sentry.analytics.record")
    def test_create_token_without_audit_or_date(
        self, record: MagicMock, create_audit_entry: MagicMock
    ) -> None:
        request = self.make_request(user=self.user, method="GET")
        api_token = SentryAppInstallationTokenCreator(
            sentry_app_installation=self.sentry_app_installation
        ).run(user=self.user, request=request)

        # verify token was created properly
        assert api_token.expires_at is None

        sentry_app_installation_tokens = SentryAppInstallationToken.objects.filter(
            sentry_app_installation=self.sentry_app_installation
        )
        assert len(sentry_app_installation_tokens) == 1

        assert not create_audit_entry.called

        assert_last_analytics_event(
            record,
            SentryAppInstallationTokenCreated(
                user_id=self.user.id,
                organization_id=self.org.id,
                sentry_app_installation_id=self.sentry_app_installation.id,
                sentry_app=self.sentry_app.slug,
            ),
        )


@control_silo_test
class TestCreatorExternal(TestCreatorBase):
    def setUp(self) -> None:
        super().setUp()

        self.sentry_app = self.create_sentry_app(
            name="external_app", organization=self.org, scopes=("org:read", "team:read")
        )

        self.sentry_app_installation = SentryAppInstallationCreator(
            slug=self.sentry_app.slug, organization_id=self.org.id
        ).run(user=self.user, request=None)

    def test_create_token(self) -> None:
        today = datetime.now(UTC)
        api_token = SentryAppInstallationTokenCreator(
            sentry_app_installation=self.sentry_app_installation, expires_at=today
        ).run(user=self.user, request=None)

        # verify token was created properly
        assert api_token.expires_at == today
        assert api_token.scope_list == ["org:read", "team:read"]
