from unittest import mock

import pytest

from sentry.auth.email import AmbiguousUserFromEmail, resolve_email_to_user
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class EmailResolverTest(TestCase):
    def setUp(self) -> None:
        self.user1 = self.create_user()
        self.user2 = self.create_user()

    def test_no_match(self) -> None:
        result = resolve_email_to_user("no_one@example.com")
        assert result is None

    def test_single_match(self) -> None:
        result = resolve_email_to_user(self.user1.email)
        assert result == self.user1

    @mock.patch("sentry.auth.email.metrics")
    def test_ambiguous_match(self, mock_metrics: mock.MagicMock) -> None:
        for user in (self.user1, self.user2):
            self.create_useremail(user=user, email="me@example.com")

        with pytest.raises(AmbiguousUserFromEmail) as excinfo:
            resolve_email_to_user("me@example.com")
        assert set(excinfo.value.users) == {self.user1, self.user2}
        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.no_resolution",)

    @mock.patch("sentry.auth.email.metrics")
    def test_prefers_verified_email(self, mock_metrics: mock.MagicMock) -> None:
        org = self.create_organization()
        self.create_useremail(user=self.user1, email="me@example.com", is_verified=True)
        self.create_useremail(user=self.user2, email="me@example.com", is_verified=False)
        self.create_member(organization=org, user_id=self.user2.id)

        result = resolve_email_to_user("me@example.com", organization=org)
        assert result == self.user1

        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.by_verification",)

    @mock.patch("sentry.auth.email.metrics")
    def test_prefers_org_member(self, mock_metrics: mock.MagicMock) -> None:
        org = self.create_organization()
        self.create_useremail(user=self.user1, email="me@example.com", is_verified=True)
        self.create_useremail(user=self.user2, email="me@example.com", is_verified=True)
        self.create_member(organization=org, user_id=self.user2.id)

        result = resolve_email_to_user("me@example.com", organization=org)
        assert result == self.user2

        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.by_org_membership",)

    @mock.patch("sentry.auth.email.metrics")
    def test_prefers_primary_email(self, mock_metrics: mock.MagicMock) -> None:
        self.create_useremail(user=self.user1, email=self.user2.email, is_verified=True)

        result = resolve_email_to_user(self.user2.email)
        assert result == self.user2

        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.by_primary_email",)

    @mock.patch("sentry.auth.email.metrics")
    def test_both_org_members_falls_through_to_primary(self, mock_metrics: mock.MagicMock) -> None:
        """
        When both users are org members, HasOrgMembership can't narrow down,
        so it falls through to IsPrimary.
        """
        org = self.create_organization()
        shared_email = "shared@example.com"

        # Both users have the shared email verified
        self.create_useremail(user=self.user1, email=shared_email, is_verified=True)
        self.user2 = self.create_user(email=shared_email)  # primary email

        # Both are org members
        self.create_member(organization=org, user_id=self.user1.id)
        self.create_member(organization=org, user_id=self.user2.id)

        # Should fall through to IsPrimary since both are org members
        result = resolve_email_to_user(shared_email, organization=org)
        assert result == self.user2  # user2 has it as primary
        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.by_primary_email",)

    @mock.patch("sentry.auth.email.metrics")
    def test_neither_org_member_falls_through_to_primary(
        self, mock_metrics: mock.MagicMock
    ) -> None:
        """
        When neither user is an org member, HasOrgMembership returns empty
        (which is ignored), so it falls through to IsPrimary.
        """
        org = self.create_organization()
        shared_email = "shared@example.com"

        # Both users have the shared email verified
        self.create_useremail(user=self.user1, email=shared_email, is_verified=True)
        self.user2 = self.create_user(email=shared_email)  # primary email

        # Neither is an org member (no create_member calls)

        # Should fall through to IsPrimary since neither is an org member
        result = resolve_email_to_user(shared_email, organization=org)
        assert result == self.user2  # user2 has it as primary
        assert mock_metrics.incr.call_args.args == ("auth.email_resolution.by_primary_email",)
