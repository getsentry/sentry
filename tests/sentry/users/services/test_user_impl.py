from sentry.auth.providers.fly.provider import FlyOAuth2Provider
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.users.services.user.service import user_service


@control_silo_test
class DatabaseBackedUserService(TestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_create_new_user(self) -> None:
        old_user_count = User.objects.all().count()
        result = user_service.get_or_create_by_email(email="test@email.com")
        user = User.objects.get(id=result.user.id)
        new_user_count = User.objects.all().count()
        assert new_user_count == old_user_count + 1
        assert user.flags.newsletter_consent_prompt
        assert result.created

    def test_get_no_existing(self) -> None:
        rpc_user = user_service.get_user_by_email(email="test@email.com")
        assert rpc_user is None

    def test_get_or_create_user(self) -> None:
        user1 = self.create_user(email="test@email.com", username="1")
        user2 = self.create_user(email="test@email.com", username="2")
        result = user_service.get_or_create_by_email(email="test@email.com")
        assert user1.id == result.user.id
        assert user2.id != result.user.id
        assert result.created is False

    def test_get_active_user(self) -> None:
        inactive_user = self.create_user(
            email="test@email.com", username="inactive", is_active=False
        )
        active_user = self.create_user(email="test@email.com", username="active")
        result = user_service.get_or_create_by_email(email="test@email.com")
        assert active_user.id == result.user.id
        assert inactive_user.id != result.user.id
        assert result.created is False

    def test_get_user_ci(self) -> None:
        user = self.create_user(email="tESt@email.com")
        result = user_service.get_or_create_by_email(email="TesT@email.com")
        assert user.id == result.user.id
        assert result.created is False

    def test_get_user_with_ident(self) -> None:
        user1 = self.create_user(email="test@email.com", username="1")
        user2 = self.create_user(email="test@email.com", username="2")
        org = self.create_organization(slug="test")
        config_data = FlyOAuth2Provider.build_config(resource={"id": "x1234x"})
        partner_user_id = "u4567u"
        provider = AuthProvider.objects.create(
            organization_id=org.id, provider="fly", config=config_data
        )
        AuthIdentity.objects.create(auth_provider=provider, user=user2, ident=partner_user_id)
        result = user_service.get_or_create_by_email(email="TesT@email.com", ident=partner_user_id)
        assert user2.id == result.user.id
        assert user1.id != result.user.id
        assert result.created is False

    def test_verify_user_emails(self) -> None:
        user1 = self.create_user(email="test@email.com")
        user2 = self.create_user(email="test2@email.com")
        verified_emails = user_service.verify_user_emails(
            user_id_emails=[
                {"user_id": user1.id, "email": "test@email.com"},
                {"user_id": user2.id, "email": "non-existent@email.com"},
            ],
            only_verified=False,
        )

        # Tests that matching emails to user ids exist
        assert verified_emails[user1.id].exists
        assert not verified_emails[user2.id].exists

    def test_verify_user_emails_only_verified(self) -> None:
        user1 = self.create_user(email="test@email.com")
        user2 = self.create_user(email="test2@email.com")
        UserEmail.objects.filter(user=user2, email="test2@email.com").update(is_verified=False)

        verified_emails = user_service.verify_user_emails(
            user_id_emails=[
                {"user_id": user1.id, "email": "test@email.com"},
                {"user_id": user2.id, "email": "test2@email.com"},
            ],
            only_verified=True,
        )

        # Tests that only verified emails are returned
        assert verified_emails[user1.id].exists
        assert not verified_emails[user2.id].exists
