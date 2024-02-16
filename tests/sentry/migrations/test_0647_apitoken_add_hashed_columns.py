from django.db import router

from sentry.silo import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AddHashedColumnsApiToken(TestMigrations):
    migrate_from = "0646_create_notification_message_table"
    migrate_to = "0647_apitoken_add_hashed_columns"

    def setUp(self):
        from sentry.models.apitoken import ApiToken

        with unguarded_write(using=router.db_for_write(ApiToken)):
            super().setUp()

    def setup_before_migration(self, apps):
        ApiToken = apps.get_model("sentry", "ApiToken")
        self.api_token = ApiToken.objects.create(
            user_id=self.user.id,
        )
        self.api_token.save()

    def test(self):
        from sentry.models.apitoken import ApiToken

        api_token = ApiToken.objects.get()
        assert api_token.hashed_token is None
        assert api_token.hashed_refresh_token is None
