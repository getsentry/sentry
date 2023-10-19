from sentry.testutils.cases import TestMigrations


class NameLastCharsApiTokenMigrationTest(TestMigrations):
    migrate_from = "0577_drop_latest_incident_index"
    migrate_to = "0578_api_tokens_add_name_and_last_four"

    def setup_before_migration(self, apps):
        ApiToken = apps.get_model("sentry", "ApiToken")
        self.api_token = ApiToken.objects.create(
            user_id=self.user.id,
            refresh_token=None,
        )
        self.api_token.save()

    def test(self):
        self.api_token.refresh_from_db()
        assert self.api_token.name is None
        assert self.api_token.token_last_characters == self.api_token.token[-4:]
