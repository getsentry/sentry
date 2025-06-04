from unittest.mock import patch

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.email import send_mail


@control_silo_test
class SendMail(TestCase):
    @patch("django.core.mail.EmailMessage", autospec=True)
    @patch("django.core.mail.get_connection", return_value="connection")
    def test_send_mail_with_kwargs(self, get_connection, MockEmailMessage):
        patch.object(MockEmailMessage.return_value, "send")
        send_mail(
            "subject", "my_message", "fake@example.com", ["a@b.com"], reply_to=["emusk@tesla.com"]
        )
        MockEmailMessage.assert_called_once_with(
            "subject",
            "my_message",
            "fake@example.com",
            ["a@b.com"],
            connection="connection",
            reply_to=["emusk@tesla.com"],
        )
        MockEmailMessage.return_value.send.assert_called_once_with(fail_silently=False)
