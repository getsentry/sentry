from django.db import router

from sentry.silo import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import no_silo_test


@no_silo_test
class LastCharsApiTokenMigrationTest(TestMigrations):
    migrate_from = "0631_add_priority_columns_to_groupedmessage"
    migrate_to = "0632_apitoken_backfill_last_chars"
    connection = "control"

    def setUp(self):
        from sentry.models.apitoken import ApiToken

        with unguarded_write(using=router.db_for_write(ApiToken)):
            super().setUp()

    @override_options({"apitoken.auto-add-last-chars": False})
    def setup_before_migration(self, apps):
        ApiToken = apps.get_model("sentry", "ApiToken")

        self.api_token = ApiToken.objects.create(
            user_id=self.user.id,
            refresh_token=None,
        )
        self.api_token.save()

        assert self.api_token.token_last_characters is None

    def test(self):
        self.api_token.refresh_from_db()
        assert self.api_token.name is None
        assert self.api_token.token_last_characters == self.api_token.token[-4:]
