from mock import patch

from django.core import mail

from sentry.models import User, UserOption, GroupEmailThread
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
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<html><body><b>hello world</b></body></html>',
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
            '<html><body><b>hello world</b></body></html>',
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

        assert len(mail.outbox) == 3

        assert sorted([out.to[0] for out in mail.outbox]) == [
            'bazzer@example.com',
            'fizzle@example.com',
            'foo@example.com',
        ]

    @patch('sentry.utils.email.make_msgid')
    def test_message_id(self, make_msgid):
        make_msgid.return_value = 'abc123'

        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
            reference=self.activity,
        )
        msg.send(['foo@example.com'])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ['foo@example.com']
        assert out.subject == 'Test'
        assert out.extra_headers['Message-Id'] == 'abc123'
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<html><body><b>hello world</b></body></html>',
            'text/html',
        )

    @patch('sentry.utils.email.make_msgid')
    def test_reply_reference(self, make_msgid):
        make_msgid.return_value = 'abc123'

        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
            reference=self.activity,
            reply_reference=self.group,
        )
        msg.send(['foo@example.com'])

        assert len(mail.outbox) == 1

        out = mail.outbox[0]
        assert out.to == ['foo@example.com']
        assert out.subject == 'Test', 'First message should not have Re: prefix'
        assert out.extra_headers['Message-Id'] == 'abc123'
        assert 'In-Reply-To' not in out.extra_headers
        assert 'References' not in out.extra_headers
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<html><body><b>hello world</b></body></html>',
            'text/html',
        )

        # Our new EmailThread row was added
        assert GroupEmailThread.objects.count() == 1
        thread = GroupEmailThread.objects.all()[0]
        assert thread.msgid == 'abc123'
        assert thread.email == 'foo@example.com'
        assert thread.group == self.group

        # new msgid for the next message
        make_msgid.return_value = '321cba'
        msg.send(['foo@example.com'])

        assert len(mail.outbox) == 2

        out = mail.outbox[1]
        assert out.to == ['foo@example.com']
        assert out.subject == 'Re: Test'
        assert out.extra_headers['Message-Id'] == '321cba'
        assert out.extra_headers['In-Reply-To'] == 'abc123'
        assert out.extra_headers['References'] == 'abc123'
        assert out.body == 'hello world'
        assert len(out.alternatives) == 1
        assert out.alternatives[0] == (
            '<html><body><b>hello world</b></body></html>',
            'text/html',
        )

        # Our new GroupEmailThread row was added
        assert GroupEmailThread.objects.count() == 1, 'Should not have added a new row'
        assert GroupEmailThread.objects.all()[0].msgid == 'abc123', 'msgid should not have changed'

    def test_get_built_messages(self):
        msg = MessageBuilder(
            subject='Test',
            body='hello world',
            html_body='<b>hello world</b>',
            reference=self.activity,
            reply_reference=self.group,
        )
        results = msg.get_built_messages(['foo@example.com'])
        assert len(results) == 1
