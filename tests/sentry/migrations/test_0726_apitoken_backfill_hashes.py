from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestBackfillApiTokenHashesMigration(TestMigrations):
    migrate_from = "0725_create_sentry_groupsearchview_table"
    migrate_to = "0726_apitoken_backfill_hashes"
    connection = "control"

    @override_options({"apitoken.save-hash-on-create": False})
    def setup_initial_state(self):
        with outbox_runner():
            self.user_1 = self.create_user()
            self.user_1_auth_token = self.create_user_auth_token(user=self.user_1)

            assert self.user_1_auth_token.hashed_token is None

    def test_for_hashed_value(self):
        self.user_1_auth_token.refresh_from_db()
        assert self.user_1_auth_token.hashed_token is not None
