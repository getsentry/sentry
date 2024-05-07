from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.silo import all_silo_test


@all_silo_test
class UserServiceTest(TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()

    def test_user_serialize_avatar_none(self):
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar is None

    def test_user_serialize_avatar(self):
        avatar = self.create_user_avatar(user_id=self.user.id, avatar_type=2, ident="abc123")
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar
        assert rpc_user.avatar.id == avatar.id
        assert rpc_user.avatar.ident == avatar.ident
        assert rpc_user.avatar.avatar_type == "gravatar"

    def test_user_serialize_multiple_emails(self):
        email = self.create_useremail(user=self.user, email="test@example.com", is_verified=True)
        unverified_email = self.create_useremail(
            user=self.user, email="nope@example.com", is_verified=False
        )

        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert len(rpc_user.emails) == 2
        assert rpc_user.emails == {email.email, self.user.email}

        assert len(rpc_user.useremails) == 3
        expected = {self.user.email, email.email, unverified_email.email}
        assert expected == {e.email for e in rpc_user.useremails}

    def test_get_many_profiles(self):
        users = [self.create_user() for _ in range(2)]
        target_ids = [users[0].id]
        profiles = user_service.get_many_profiles(filter=dict(user_ids=target_ids))
        assert len(profiles) == 1
        assert profiles[0].id == users[0].id
