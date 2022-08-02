from sentry.models import Activity
from sentry.tasks.email import process_inbound_email
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType


class ProcessInboundEmailTest(TestCase):
    def test_task_persistent_name(self):
        assert process_inbound_email.name == "sentry.tasks.email.process_inbound_email"

    def test_simple(self):
        group = self.create_group()

        process_inbound_email(mailfrom=self.user.email, group_id=group.id, payload="hello world!")

        activity = Activity.objects.get(group=group, type=ActivityType.NOTE.value)
        assert activity.user == self.user
        assert activity.data["text"] == "hello world!"

    def test_handle_unknown_address(self):
        group = self.create_group()

        process_inbound_email(
            mailfrom="invalid@example.com", group_id=group.id, payload="hello world!"
        )

        assert not Activity.objects.filter(group=group, type=ActivityType.NOTE.value).exists()
