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

    def test_get_user_by_email_ignores_unicode_lookalike(self) -> None:
        self.create_user(email="admin@email.com")
        assert user_service.get_user_by_email(email="adm\u0131n@email.com") is None

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

    def test_update_user_with_superuser_and_staff_fields(self) -> None:
        """Test that update_user correctly handles is_superuser and is_staff fields."""
        user = self.create_user(is_superuser=False, is_staff=False)

        # Update user to have superuser and staff privileges
        result = user_service.update_user(
            user_id=user.id,
            attrs={
                "is_superuser": True,
                "is_staff": True,
            },
        )

        assert result is not None
        user.refresh_from_db()
        assert user.is_superuser is True
        assert user.is_staff is True

        result = user_service.update_user(
            user_id=user.id,
            attrs={
                "is_superuser": False,
                "is_staff": False,
            },
        )

        assert result is not None
        user.refresh_from_db()
        assert user.is_staff is False
        assert user.is_superuser is False  # type: ignore[unreachable]

    def test_update_user_with_nonexistent_user(self) -> None:
        """Test that update_user returns None for nonexistent users."""
        result = user_service.update_user(
            user_id=999999,
            attrs={
                "is_superuser": True,
                "is_staff": True,
            },
        )
        assert result is None


@control_silo_test
class EmailMatchingCollationTest(TestCase):
    """Email lookups must not depend on the database collation.

    ``__iexact`` / ``in_iexact`` compile to a locale-aware ``UPPER()`` comparison,
    which can fold some non-ASCII code points onto ASCII letters. The user service
    re-checks results with ASCII-only case folding, so only ASCII case differences
    are treated as the same address.
    """

    EMAIL = "owner@example-corp.example"
    # differs from EMAIL by one non-ASCII character in the domain
    NON_ASCII_VARIANT = "owner@example-corp.exımple"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email=self.EMAIL)

    def test_get_many_by_email_requires_ascii_match(self) -> None:
        assert (
            user_service.get_many_by_email(emails=[self.NON_ASCII_VARIANT], is_verified=False) == []
        )
        assert [u.id for u in user_service.get_many_by_email(emails=[self.EMAIL])] == [self.user.id]
        assert [u.id for u in user_service.get_many_by_email(emails=[self.EMAIL.upper()])] == [
            self.user.id
        ]

    def test_get_user_by_email_matches_ascii_case(self) -> None:
        found = user_service.get_user_by_email(email=self.EMAIL.upper())
        assert found is not None and found.id == self.user.id

    def test_get_or_create_by_email_treats_non_ascii_variant_as_new(self) -> None:
        result = user_service.get_or_create_by_email(email=self.NON_ASCII_VARIANT)
        assert result.created is True
        assert result.user.id != self.user.id

    def test_verify_any_email_requires_ascii_match(self) -> None:
        UserEmail.objects.filter(user=self.user).update(is_verified=False)
        assert user_service.verify_any_email(email=self.NON_ASCII_VARIANT) is False
        assert UserEmail.objects.get(user=self.user, email=self.EMAIL).is_verified is False
        assert user_service.verify_any_email(email=self.EMAIL.upper()) is True
        assert UserEmail.objects.get(user=self.user, email=self.EMAIL).is_verified is True

    def test_verify_user_email_requires_ascii_match(self) -> None:
        UserEmail.objects.filter(user=self.user).update(is_verified=False)
        assert (
            user_service.verify_user_email(email=self.NON_ASCII_VARIANT, user_id=self.user.id)
            is False
        )
        assert UserEmail.objects.get(user=self.user, email=self.EMAIL).is_verified is False

    def test_verify_user_emails_requires_ascii_match(self) -> None:
        result = user_service.verify_user_emails(
            user_id_emails=[{"user_id": self.user.id, "email": self.NON_ASCII_VARIANT}]
        )
        assert result[self.user.id].exists is False
        result = user_service.verify_user_emails(
            user_id_emails=[{"user_id": self.user.id, "email": self.EMAIL.upper()}]
        )
        assert result[self.user.id].exists is True
