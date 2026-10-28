from datetime import timedelta
from unittest.mock import patch

from sentry.models.activity import Activity
from sentry.models.groupsubscription import GroupSubscription
from sentry.tasks.email import process_inbound_email
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType

pytestmark = [requires_snuba]


class ProcessInboundEmailTest(TestCase):
    def test_invalid_text(self) -> None:
        group = self.create_group()

        for payload in ("", " \t\n", "hello\x00world"):
            process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload=payload)

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()

    def test_duplicate_delivery(self) -> None:
        group = self.create_group()

        process_inbound_email(
            mailfrom=self.user.email, group_id=group.id, payload=" \thello world!\n"
        )
        # Email delivery remains idempotent beyond the API's one-hour window.
        original = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        original.update(datetime=original.datetime - timedelta(hours=2))
        process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload="hello world!")

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.data == {"text": "hello world!"}

    def test_simple(self) -> None:
        group = self.create_group()
        integration = self.create_integration(
            organization=group.organization, provider="example", external_id="123456"
        )
        self.create_integration_external_issue(group=group, integration=integration, key="APP-123")

        with (
            patch("sentry.issues.comments.create_external_comment.apply_async") as sync_comment,
            patch("sentry.issues.comments.comment_created.send_robust") as comment_created,
        ):
            process_inbound_email(
                mailfrom=self.user.email, group_id=group.id, payload="hello world!"
            )

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.user_id == self.user.id
        assert activity.data["text"] == "hello world!"
        assert not GroupSubscription.objects.filter(group=group, user_id=self.user.id).exists()
        sync_comment.assert_not_called()
        comment_created.assert_not_called()

    def test_handle_unknown_address(self) -> None:
        group = self.create_group()

        process_inbound_email(
            mailfrom="invalid@example.com", group_id=group.id, payload="hello world!"
        )

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()
