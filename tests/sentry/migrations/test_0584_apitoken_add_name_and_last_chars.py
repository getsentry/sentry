from django.db import router

from sentry.silo import unguarded_write
from sentry.testutils.cases import TestMigrations


class NameLastCharsApiTokenMigrationTest(TestMigrations):
    migrate_from = "0583_add_early_adopter_to_organization_mapping"
    migrate_to = "0584_apitoken_add_name_and_last_chars"

    def setUp(self):
        from sentry.models.apitoken import ApiToken

        with unguarded_write(using=router.db_for_write(ApiToken)):
            super().setUp()

    def setup_before_migration(self, apps):
        ApiToken = apps.get_model("sentry", "ApiToken")
        self.api_token = ApiToken.objects.create(
            user_id=self.user.id,
            refresh_token=None,
        )
        self.api_token.save()

    def test(self):
        from sentry.models.apitoken import ApiToken

        api_token = ApiToken.objects.get()
        assert api_token.name is None
        assert api_token.token_last_characters is None
