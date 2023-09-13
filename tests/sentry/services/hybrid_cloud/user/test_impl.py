from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class DatabaseBackedUserService(TestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_get_or_create_user(self):
        user1 = self.create_user(email="test@email.com", username="1")
        user2 = self.create_user(email="test@email.com", username="2")
        user = user_service.get_or_create_user_by_email(email="test@email.com")
        assert user1.id == user.id
        assert user2.id != user.id

    def test_get_active_user(self):
        inactive_user = self.create_user(
            email="test@email.com", username="inactive", is_active=False
        )
        active_user = self.create_user(email="test@email.com", username="active")
        user = user_service.get_or_create_user_by_email(email="test@email.com")
        assert active_user.id == user.id
        assert inactive_user.id != user.id

    def test_get_user_ci(self):
        user = self.create_user(email="tESt@email.com")
        fetched_user = user_service.get_or_create_user_by_email(email="TesT@email.com")
        assert user.id == fetched_user.id
