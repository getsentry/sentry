from __future__ import absolute_import

from django.core import mail

from sentry.models import Activity, Release
from sentry.testutils import TestCase


class SendNotificationTest(TestCase):
    def test_note(self):
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

        with self.tasks():
            activity.send_notification()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == '[Sentry] [foo Bar] ERROR: Foo bar'
        assert msg.to == [self.user.email]

    def test_release(self):
        user_foo = self.create_user('foo@example.com')

        release = Release.objects.create(
            project=self.project,
            version='a' * 40,
        )

        activity = Activity.objects.create(
            project=self.project,
            type=Activity.RELEASE,
            user=user_foo,
            event=self.create_event('a' * 32, group=self.group),
            data={
                'version': release.version,
            },
        )

        self.project.team.organization.member_set.create(user=user_foo)

        with self.tasks():
            activity.send_notification()

        assert len(mail.outbox) == 1

        msg = mail.outbox[0]

        assert msg.subject == '[Sentry] Release %s' % (release.version,)
        assert msg.to == [self.user.email]
