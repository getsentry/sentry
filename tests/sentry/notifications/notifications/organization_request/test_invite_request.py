from django.core import mail

from sentry.notifications.notifications.organization_request.invite_request import (
    InviteRequestNotification,
)
from sentry.testutils.cases import TestCase


class TestInviteRequestNotification(TestCase):
    def test_sanitizes_periods_in_inviter_name(self) -> None:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        inviter = self.create_user(name="evil.com")
        self.create_member(user=inviter, organization=org)

        pending_member = self.create_member(
            organization=org, email="newuser@example.com", role="member", inviter_id=inviter.id
        )

        notification = InviteRequestNotification(pending_member, inviter)

        with self.tasks():
            notification.send()

        assert len(mail.outbox) == 1
        # get_salutation_name() capitalizes the first letter
        assert "Evil.com" not in mail.outbox[0].body
        assert "Evil\u2060.com" in mail.outbox[0].body
