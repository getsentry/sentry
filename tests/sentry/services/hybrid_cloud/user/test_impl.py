from sentry.auth.providers.fly.provider import FlyOAuth2Provider
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.user import User
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class DatabaseBackedUserService(TestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_create_new_user(self):
        old_user_count = User.objects.all().count()
        result = user_service.get_or_create_user_by_email__tmp(email="test@email.com")
        rpc_user, created = result.user, result.was_newly_created
        user = User.objects.get(id=rpc_user.id)
        new_user_count = User.objects.all().count()
        assert new_user_count == old_user_count + 1
        assert user.flags.newsletter_consent_prompt
        assert created

    def test_get_no_existing(self):
        rpc_user = user_service.get_user_by_email(email="test@email.com")
        assert rpc_user is None

    def test_get_or_create_user(self):
        user1 = self.create_user(email="test@email.com", username="1")
        user2 = self.create_user(email="test@email.com", username="2")
        result = user_service.get_or_create_user_by_email__tmp(email="test@email.com")
        user, created = result.user, result.was_newly_created
        assert user1.id == user.id
        assert user2.id != user.id
        assert created is False

    def test_get_active_user(self):
        inactive_user = self.create_user(
            email="test@email.com", username="inactive", is_active=False
        )
        active_user = self.create_user(email="test@email.com", username="active")
        result = user_service.get_or_create_user_by_email__tmp(email="test@email.com")
        user, created = result.user, result.was_newly_created
        assert active_user.id == user.id
        assert inactive_user.id != user.id
        assert created is False

    def test_get_user_ci(self):
        user = self.create_user(email="tESt@email.com")
        result = user_service.get_or_create_user_by_email__tmp(email="TesT@email.com")
        fetched_user, created = result.user, result.was_newly_created
        assert user.id == fetched_user.id
        assert created is False

    def test_get_user_with_ident(self):
        user1 = self.create_user(email="test@email.com", username="1")
        user2 = self.create_user(email="test@email.com", username="2")
        org = self.create_organization(slug="test")
        config_data = FlyOAuth2Provider.build_config(resource={"id": "x1234x"})
        partner_user_id = "u4567u"
        provider = AuthProvider.objects.create(
            organization_id=org.id, provider="fly", config=config_data
        )
        AuthIdentity.objects.create(auth_provider=provider, user=user2, ident=partner_user_id)
        result = user_service.get_or_create_user_by_email__tmp(
            email="TesT@email.com", ident=partner_user_id
        )
        fetched_user, created = result.user, result.was_newly_created
        assert user2.id == fetched_user.id
        assert user1.id != fetched_user.id
        assert created is False
