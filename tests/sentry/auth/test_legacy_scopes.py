from sentry.auth.legacy_scopes import (
    credential_allows_legacy_read_writes,
    held_legacy_read_write_scopes,
    without_legacy_read_write_scopes,
)
from sentry.auth.services.auth.model import AuthenticatedToken
from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.models.apiapplication import ApiApplication
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test


def test_held_legacy_read_write_scopes() -> None:
    allowed = {"legacy:org-read-writes", "org:write"}
    assert held_legacy_read_write_scopes(allowed, {"org:read"}) == {"legacy:org-read-writes"}
    assert held_legacy_read_write_scopes(allowed, {"project:read"}) == set()


def test_without_legacy_read_write_scopes() -> None:
    assert without_legacy_read_write_scopes({"legacy:org-read-writes", "org:write"}) == {
        "org:write"
    }


@control_silo_test
class CredentialAllowsLegacyReadWritesTest(TestCase):
    def setUp(self) -> None:
        self.old_token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])
        self.new_token = self.create_user_auth_token(user=self.user, scope_list=["org:read"])

    def test_session(self) -> None:
        with override_options({"api.legacy-read-writes.max-user-token-id": self.old_token.id}):
            assert credential_allows_legacy_read_writes(None)

    def test_cutoff_disabled(self) -> None:
        assert credential_allows_legacy_read_writes(self.new_token)

    def test_user_token(self) -> None:
        with override_options({"api.legacy-read-writes.max-user-token-id": self.old_token.id}):
            assert credential_allows_legacy_read_writes(self.old_token)
            assert not credential_allows_legacy_read_writes(self.new_token)

    def test_replica_uses_control_token_id(self) -> None:
        replica = ApiTokenReplica(
            id=1, apitoken_id=self.new_token.id, user_id=self.user.id, application_id=None
        )
        with override_options({"api.legacy-read-writes.max-user-token-id": self.old_token.id}):
            assert not credential_allows_legacy_read_writes(replica)

    def test_authenticated_token(self) -> None:
        token = AuthenticatedToken.from_token(self.new_token)
        with override_options({"api.legacy-read-writes.max-user-token-id": self.old_token.id}):
            assert not credential_allows_legacy_read_writes(token)

    def test_application_token_is_exempt(self) -> None:
        # OAuth and integration tokens are reissued on refresh, so their id isn't a
        # usable grant date.
        application = ApiApplication.objects.create(owner=self.user)
        token = ApiToken.objects.create(
            user=self.user, application=application, scope_list=["org:read"]
        )
        with override_options({"api.legacy-read-writes.max-user-token-id": self.old_token.id}):
            assert credential_allows_legacy_read_writes(token)
