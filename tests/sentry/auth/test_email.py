from sentry.auth.email import AmbiguousUserFromEmail, resolve_email_to_user
from sentry.models import UserEmail
from sentry.testutils import TestCase


class EmailResolverTest(TestCase):
    def setUp(self) -> None:
        self.user1 = self.create_user()
        self.user2 = self.create_user()

    def test_no_match(self):
        result = resolve_email_to_user("no_one@example.com")
        assert result is None

    def test_single_match(self):
        result = resolve_email_to_user(self.user1.email)
        assert result == self.user1

    def test_ambiguous_match(self):
        for user in (self.user1, self.user2):
            UserEmail.objects.create(user=user, email="me@example.com")

        with self.assertRaises(AmbiguousUserFromEmail) as context:
            resolve_email_to_user("me@example.com")
        assert set(context.exception.users) == {self.user1, self.user2}
