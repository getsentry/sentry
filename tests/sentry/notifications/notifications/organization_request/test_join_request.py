from django.core import mail

from sentry.models.organizationmember import InviteStatus
from sentry.notifications.notifications.organization_request.join_request import (
    JoinRequestNotification,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class TestJoinRequestNotification(TestCase):
    def _send_join_request_email(self) -> str:
        owner = self.create_user("owner@example.com")
        org = self.create_organization(owner=owner)
        pending_member = self.create_member(
            organization=org,
            email="newuser@example.com",
            role="member",
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )

        notification = JoinRequestNotification(pending_member, owner)
        with self.tasks():
            notification.send()

        assert len(mail.outbox) == 1
        [(html, _)] = mail.outbox[0].alternatives
        return html

    def test_email_settings_label(self) -> None:
        html = self._send_join_request_email()
        assert ">Organization Settings</a>" in html

    @with_feature("organizations:settings-v3")
    def test_email_settings_label_settings_v3(self) -> None:
        html = self._send_join_request_email()
        assert ">Org Settings</a>" in html
