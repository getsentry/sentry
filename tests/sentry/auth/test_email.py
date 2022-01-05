from unittest import mock

from sentry.auth.email import resolve_email_to_user
from sentry.models import OrganizationMember, UserEmail
from sentry.testutils import TestCase


class EmailResolverTest(TestCase):
    @mock.patch("sentry.auth.email.sentry_sdk")
    def test_no_match(self, mock_sdk):
        result = resolve_email_to_user("me@example.com")
        assert result is None
        assert not mock_sdk.capture_message.called

    @mock.patch("sentry.auth.email.sentry_sdk")
    def test_single_match(self, mock_sdk):
        user = self.create_user()
        result = resolve_email_to_user(user.email)
        assert result == user
        assert not mock_sdk.capture_message.called

    @mock.patch("sentry.auth.email.sentry_sdk")
    def test_ambiguous_match(self, mock_sdk):
        users = {self.create_user() for _ in range(2)}
        for user in users:
            UserEmail.objects.create(user=user, email="me@example.com")
        result = resolve_email_to_user("me@example.com")
        assert result in users
        assert mock_sdk.capture_message.called

    @mock.patch("sentry.auth.email.sentry_sdk")
    def test_prefers_verified_email(self, mock_sdk):
        org = self.create_organization()

        user1 = self.create_user()
        UserEmail.objects.create(user=user1, email="me@example.com", is_verified=True)

        user2 = self.create_user()
        UserEmail.objects.create(user=user2, email="me@example.com", is_verified=False)
        OrganizationMember.objects.create(organization=org, user=user2)

        result = resolve_email_to_user("me@example.com", organization=org)
        assert result == user1
        assert not mock_sdk.capture_message.called

    @mock.patch("sentry.auth.email.sentry_sdk")
    def test_prefers_org_member(self, mock_sdk):
        org = self.create_organization()

        user1 = self.create_user()
        UserEmail.objects.create(user=user1, email="me@example.com", is_verified=True)

        user2 = self.create_user()
        UserEmail.objects.create(user=user2, email="me@example.com", is_verified=True)
        OrganizationMember.objects.create(organization=org, user=user2)

        result = resolve_email_to_user("me@example.com", organization=org)
        assert result == user2
        assert not mock_sdk.capture_message.called
