from django.core import mail

from sentry.models import Activity
from sentry.testutils import TestCase


class SendNotificationTest(TestCase):
    def test_simple(self):
        user_foo = self.create_user('foo@example.com')

        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=Activity.NOTE,
            user=user_foo,
            event=self.create_event('a' * 32, group=self.group),
            data={
                'text': 'sup guise',
            },
        )

        self.project.team.member_set.create(user=user_foo)

        activity.send_notification()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == '[Sentry] [Bar] foo@example.com: sup guise'
        assert msg.to == [self.user.email]
