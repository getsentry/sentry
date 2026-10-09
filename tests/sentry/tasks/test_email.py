from sentry.models.activity import Activity
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
        process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload="hello world!")

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.data == {"text": "hello world!"}

    def test_simple(self) -> None:
        group = self.create_group()

        process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload="hello world!")

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.user_id == self.user.id
        assert activity.data["text"] == "hello world!"

    def test_handle_unknown_address(self) -> None:
        group = self.create_group()

        process_inbound_email(
            mailfrom="invalid@example.com", group_id=group.id, payload="hello world!"
        )

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()
