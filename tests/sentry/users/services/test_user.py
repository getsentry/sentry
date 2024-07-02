from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.silo import all_silo_test
from sentry.users.services.user.service import user_service


@all_silo_test
class UserServiceTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()

    def test_user_serialize_avatar_none(self) -> None:
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar is None

    def test_user_serialize_avatar(self) -> None:
        avatar = self.create_user_avatar(user_id=self.user.id, avatar_type=2, ident="abc123")
        rpc_user = user_service.get_user(user_id=self.user.id)
        assert rpc_user
        assert rpc_user.avatar
        assert rpc_user.avatar.id == avatar.id
        assert rpc_user.avatar.ident == avatar.ident
        assert rpc_user.avatar.avatar_type == "gravatar"

    def test_user_serialize_multiple_emails(self) -> None:
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

    def test_get_many_profiles(self) -> None:
        users = [self.create_user() for _ in range(2)]
        target_ids = [users[0].id]
        profiles = user_service.get_many_profiles(filter=dict(user_ids=target_ids))
        assert len(profiles) == 1
        assert profiles[0].id == users[0].id

    def test_get_many_by_id(self) -> None:
        users = [self.create_user() for _ in range(2)]
        target_ids = [users[0].id]
        result = user_service.get_many_by_id(ids=target_ids)

        assert len(result) == 1
        assert result[0].id == users[0].id

        result = user_service.get_many_by_id(ids=target_ids)
        result_two = user_service.get_many_by_id(ids=target_ids)
        assert result == result_two
