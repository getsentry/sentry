from sentry.codecov.helper import CodecovUser, resolve_codecov_user
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class TestCodecovUserResolution(TestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user()

    def test_get_auth_provider_identity_for_user(self):
        auth_provider = self.create_auth_provider(
            organization_id=self.organization.id, provider="github"
        )
        self.create_auth_identity(
            auth_provider=auth_provider,
            user=self.user,
            ident=12345,
            data={"access_token": "this_is_the_access_token_stored_here"},
        )
        assert resolve_codecov_user(self.user.id, self.organization.id) == CodecovUser(
            external_id="12345", auth_token="this_is_the_access_token_stored_here"
        )

    def test_get_auth_identity_for_user(self):
        # Create the Auth Provider to fall through
        self.create_auth_provider(organization_id=self.organization.id, provider="github")

        identity_provider = self.create_identity_provider(type="github")
        self.create_identity(
            user=self.user,
            identity_provider=identity_provider,
            external_id="identity_id_12345",
            data={"access_token": "this_is_the_access_token_stored_here"},
        )

        assert resolve_codecov_user(self.user.id, self.organization.id) == CodecovUser(
            external_id="identity_id_12345", auth_token="this_is_the_access_token_stored_here"
        )

    def test_no_linked_identity(self):
        assert resolve_codecov_user(self.user.id, self.organization.id) is None
