from django.test import override_settings

from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import control_silo_test


@control_silo_test
@override_settings(SENTRY_SELF_HOSTED=True)
class BackfillSelfHostedSentryAppEmailsTest(TestMigrations):
    migrate_from = "0996_add_dashboard_field_link_model"
    migrate_to = "0997_backfill_self_hosted_sentry_app_emails"
    connection = "control"

    def setup_before_migration(self, apps):
        self.placeholder_domain = "proxy-user.sentry.io"
        self.proxy_user = self.create_user(
            username="sentry-app-randomuuid123", email="", is_sentry_app=True
        )
        self.regular_user = self.create_user(username="regular@user", email="regular@user")

        return super().setup_before_migration(apps)

    def test(self) -> None:
        self.proxy_user.refresh_from_db()
        self.regular_user.refresh_from_db()
        assert self.proxy_user.email == f"{self.proxy_user.username}@{self.placeholder_domain}"
        assert self.regular_user.email == "regular@user"
