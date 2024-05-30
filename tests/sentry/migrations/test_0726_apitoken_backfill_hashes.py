from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import assume_test_silo_mode


class TestBackfillApiTokenHashesMigration(TestMigrations):
    migrate_from = "0725_create_sentry_groupsearchview_table"
    migrate_to = "0726_apitoken_backfill_hashes"
    connection = "control"

    @override_options({"apitoken.save-hash-on-create": False})
    def setup_initial_state(self):
        self.user_1 = self.create_user()
        self.user_1_auth_token = self.create_user_auth_token(user=self.user_1)

        assert self.user_1_auth_token.hashed_token is None

    def test(self):

        with assume_test_silo_mode(SiloMode.CONTROL):
            from sentry.models.apitoken import ApiToken

            api_tokens = ApiToken.objects.all()
            for api_token in api_tokens:
                assert api_token.hashed_token is not None
