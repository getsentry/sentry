from django.core import mail

from sentry.models import User, UserOption
from sentry.testutils import TestCase
from sentry.utils.email import MessageBuilder


class MessageBuilderTest(TestCase):
    def test_raw_content(self):
        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
            headers={'X-Test': 'foo'},
        )
        msg.send(['foo@example.com'])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ['foo@example.com']
        assert out.subject == 'Test'
        assert out.extra_headers['X-Test'] == 'foo'
        assert out.extra_headers['Reply-To'] == 'foo@example.com'
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<b>hello world</b>',
            'text/html',
        )

    def test_explicit_reply_to(self):
        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
            headers={'X-Sentry-Reply-To': 'bar@example.com'},
        )
        msg.send(['foo@example.com'])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ['foo@example.com']
        assert out.subject == 'Test'
        assert out.extra_headers['Reply-To'] == 'bar@example.com'
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<b>hello world</b>',
            'text/html',
        )

    def test_with_users(self):
        project = self.project

        user_a = User.objects.create(email='foo@example.com')
        user_b = User.objects.create(email='bar@example.com')
        user_c = User.objects.create(email='baz@example.com')

        UserOption.objects.create(
            user=user_b,
            key='alert_email',
            value='fizzle@example.com',
        )
        UserOption.objects.create(
            user=user_c,
            project=project,
            key='mail:email',
            value='bazzer@example.com',
        )

        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
        )
        msg.add_users([user_a.id, user_b.id, user_c.id], project=project)
        msg.send()

        assert len(mail.outbox) == 1

        out = mail.outbox[0]

        assert sorted(out.to) == [
            'bazzer@example.com',
            'fizzle@example.com',
            'foo@example.com',
        ]
