from sentry.auth.email import AmbiguousUserResolution, AuthHelperResolution, IdentityViewResolution
from sentry.models import OrganizationMember, UserEmail
from sentry.testutils import TestCase


class AuthHelperResolutionTest(TestCase):
    def setUp(self) -> None:
        self.org = self.create_organization()

    def test_no_match(self):
        result = AuthHelperResolution("me@example.com", self.org).resolve()
        assert result is None

    def test_single_match(self):
        user = self.create_user()
        result = AuthHelperResolution(user.email, self.org).resolve()
        assert result == user

    def test_ambiguous_match(self):
        users = {self.create_user() for _ in range(2)}
        for user in users:
            UserEmail.objects.create(user=user, email="me@example.com")

        try:
            AuthHelperResolution("me@example.com", self.org).resolve()
        except AmbiguousUserResolution as e:
            assert set(e.users) == users
        else:
            self.fail()

    def test_prefers_verified_email(self):
        user1 = self.create_user()
        UserEmail.objects.create(user=user1, email="me@example.com", is_verified=True)

        user2 = self.create_user()
        UserEmail.objects.create(user=user2, email="me@example.com", is_verified=False)
        OrganizationMember.objects.create(organization=self.org, user=user2)

        result = AuthHelperResolution("me@example.com", self.org).resolve()
        assert result == user1

    def test_prefers_org_member(self):
        user1 = self.create_user()
        UserEmail.objects.create(user=user1, email="me@example.com", is_verified=True)

        user2 = self.create_user()
        UserEmail.objects.create(user=user2, email="me@example.com", is_verified=True)
        OrganizationMember.objects.create(organization=self.org, user=user2)

        result = AuthHelperResolution("me@example.com", self.org).resolve()
        assert result == user2


class IdentityViewResolutionTest(TestCase):
    def test_rejects_unverified(self):
        user = self.create_user()
        UserEmail.objects.create(user=user, email="me@example.com", is_verified=False)
        result = IdentityViewResolution("me@example.com", user).resolve()
        assert result is None

    def test_single_match(self):
        user = self.create_user()
        UserEmail.objects.create(user=user, email="me@example.com", is_verified=True)
        result = IdentityViewResolution("me@example.com", user).resolve()
        assert result == user

    def test_prefers_logged_in_user(self):
        logged_in_user = self.create_user()
        assert logged_in_user.is_authenticated
        UserEmail.objects.create(user=logged_in_user, email="me@example.com", is_verified=True)

        self.create_user(email="me@example.com")

        result = IdentityViewResolution("me@example.com", logged_in_user).resolve()
        assert result == logged_in_user

    def test_prefers_user_with_primary_email(self):
        primary_user = self.create_user(email="me@example.com")

        secondary_user = self.create_user()
        UserEmail.objects.create(user=secondary_user, email="me@example.com", is_verified=True)

        anonymous_user = self.create_user()
        result = IdentityViewResolution("me@example.com", anonymous_user).resolve()
        assert result == primary_user

    def test_ambiguous_match(self):
        users = {self.create_user() for _ in range(2)}
        for user in users:
            UserEmail.objects.create(user=user, email="me@example.com", is_verified=True)

        anonymous_user = self.create_user()
        try:
            IdentityViewResolution("me@example.com", anonymous_user).resolve()
        except AmbiguousUserResolution as e:
            assert set(e.users) == users
        else:
            self.fail()
