from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope
from sentry.testutils.cases import TestMigrations
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestBackfillApiTokenHashesMigration(TestMigrations):
    migrate_from = "0725_create_sentry_groupsearchview_table"
    migrate_to = "0726_apitoken_backfill_hashes"
    connection = "control"

    @override_options({"apitoken.save-hash-on-create": False})
    def setup_initial_state(self):
        user = self.create_user()
        self.user_auth_token = self.create_user_auth_token(user=user)

        # Put the user in an org so we have membership
        organization = self.create_organization(owner=user)

        app = self.create_sentry_app(user=user, organization_id=organization.id)
        self.app_install = self.create_sentry_app_installation(
            organization=organization, user=user, slug=app.slug
        )

        assert self.user_auth_token.hashed_token is None
        # user auth tokens do not have refresh tokens
        assert self.user_auth_token.refresh_token is None

        assert self.app_install.api_token.hashed_token is None
        assert self.app_install.api_token.hashed_refresh_token is None
        # tokens related to sentry apps do have refresh tokens
        assert self.app_install.api_token.refresh_token is not None

    def test_for_hashed_value(self):
        self.user_auth_token.refresh_from_db()
        assert self.user_auth_token.hashed_token is not None
        assert ControlOutbox.objects.get(
            shard_scope=OutboxScope.USER_SCOPE,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=self.user_auth_token.id,
            shard_identifier=self.user_auth_token.user_id,
        )

        self.app_install.refresh_from_db()
        assert self.app_install.api_token.hashed_token is not None
        assert self.app_install.api_token.hashed_refresh_token is not None
        assert ControlOutbox.objects.get(
            shard_scope=OutboxScope.USER_SCOPE,
            category=OutboxCategory.API_TOKEN_UPDATE,
            object_identifier=self.app_install.api_token.id,
            shard_identifier=self.app_install.api_token.user_id,
        )
