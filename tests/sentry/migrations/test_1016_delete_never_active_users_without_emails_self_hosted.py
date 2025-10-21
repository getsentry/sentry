from django.test import override_settings

from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import control_silo_test
from sentry.users.models import User


@control_silo_test
@override_settings(SENTRY_SELF_HOSTED=True)
class BackfillSelfHostedSentryAppEmailsTest(TestMigrations):
    migrate_from = "1015_backfill_self_hosted_sentry_app_emails"
    migrate_to = "1016_delete_never_active_users_without_emails_self_hosted"
    connection = "control"

    def setup_before_migration(self, apps):
        self.target_user = self.create_user(username="froggy-chair", email="", last_active=None)
        self.regular_user = self.create_user(username="regular@user", email="regular@user")

        return super().setup_before_migration(apps)

    def test(self) -> None:
        assert User.objects.filter(id=self.target_user.id).first() is None
        assert User.objects.filter(id=self.regular_user.id).first() == self.regular_user
