from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.testutils.cases import TestMigrations


class TestAdjustArrayColumn(TestMigrations):
    app = "hybridcloud"
    migrate_from = "0019_add_provider_webhook_payload"
    migrate_to = "0020_fix_scope_list_type"

    def setup_initial_state(self) -> None:
        apitoken = self.create_user_auth_token(self.user)
        self.key_id = ApiTokenReplica.objects.create(
            scope_list=["project:read", "project:write"],
            user_id=self.user.id,
            apitoken_id=apitoken.id,
        ).id

    def test(self) -> None:
        assert ApiTokenReplica.objects.get(id=self.key_id).scope_list == [
            "project:read",
            "project:write",
        ]
