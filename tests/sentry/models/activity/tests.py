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

        self.project.team.organization.member_set.create(user=user_foo)

        with self.settings(CELERY_ALWAYS_EAGER=True):
            activity.send_notification()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == 'Re: [Sentry] [foo Bar] ERROR: Foo bar'
        assert msg.to == [self.user.email]
        assert msg.extra_headers['Message-Id'] == '<activity/%s@localhost>' % activity.pk
        assert msg.extra_headers['In-Reply-To'] == '<group/%s@localhost>' % self.group.pk
        assert msg.extra_headers['References'] == '<group/%s@localhost>' % self.group.pk
