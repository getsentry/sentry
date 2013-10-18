from django.core import mail

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
