from __future__ import absolute_import, print_function

from django.core import mail

from sentry.models import InviteStatus, OrganizationMember
from sentry.testutils import TestCase
from sentry.tasks.members import send_invite_request_notification_email


class InviteRequestNotificationTest(TestCase):
    def test_send_notification(self):
        organization = self.create_organization()

        user1 = self.create_user(email="manager@localhost")
        user2 = self.create_user(email="owner@localhost")
        user3 = self.create_user(email="member@localhost")

        self.create_member(organization=organization, user=user1, role="manager")
        self.create_member(organization=organization, user=user2, role="owner")
        self.create_member(organization=organization, user=user3, role="member")

        member = OrganizationMember.objects.create(
            role="manager",
            organization=organization,
            email="foo@example.com",
            inviter=user3,
            invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value,
        )
        with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
            send_invite_request_notification_email(member.id)

        assert len(mail.outbox) == 2

        assert mail.outbox[0].to == ["manager@localhost"]
        assert mail.outbox[1].to == ["owner@localhost"]

        expected_subject = "Access request to %s" % (organization.name,)
        assert mail.outbox[0].subject == expected_subject
