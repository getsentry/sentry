from smtplib import SMTPServerDisconnected
from unittest.mock import MagicMock, call, patch

import pytest
from django.core.mail import EmailMultiAlternatives

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.email import send_mail
from sentry.utils.email.send import send_messages


@control_silo_test
class SendMail(TestCase):
    @patch("django.core.mail.EmailMessage", autospec=True)
    @patch("django.core.mail.get_connection", return_value="connection")
    def test_send_mail_with_kwargs(
        self, get_connection: MagicMock, MockEmailMessage: MagicMock
    ) -> None:
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


def _message() -> EmailMultiAlternatives:
    return EmailMultiAlternatives(
        "subject",
        "body",
        "from@example.com",
        ["to@example.com"],
        headers={"Message-Id": "<test@example.com>"},
    )


@control_silo_test
class SendMessagesTest(TestCase):
    @patch("sentry.utils.email.send.metrics.incr")
    def test_records_success(self, incr: MagicMock) -> None:
        assert send_messages([_message(), _message()]) == 2

        assert incr.call_args_list == [
            call("email.sent", 2, skip_internal=False, tags={"success": True}),
        ]

    @patch("sentry.utils.email.send.metrics.incr")
    @patch("sentry.utils.email.send.get_connection")
    def test_records_failure_when_send_raises(
        self, get_connection: MagicMock, incr: MagicMock
    ) -> None:
        get_connection.return_value.send_messages.side_effect = SMTPServerDisconnected(
            "Connection unexpectedly closed"
        )

        with pytest.raises(SMTPServerDisconnected):
            send_messages([_message(), _message()])

        assert incr.call_args_list == [
            call(
                "email.sent",
                2,
                skip_internal=False,
                tags={"success": False, "error_type": "SMTPServerDisconnected"},
            ),
        ]

    @patch("sentry.utils.email.send.metrics.incr")
    @patch("sentry.utils.email.send.get_connection")
    def test_records_partial_failure(self, get_connection: MagicMock, incr: MagicMock) -> None:
        get_connection.return_value.send_messages.return_value = 1

        assert send_messages([_message(), _message()], fail_silently=True) == 1

        assert incr.call_args_list == [
            call("email.sent", 1, skip_internal=False, tags={"success": True}),
            call("email.sent", 1, skip_internal=False, tags={"success": False}),
        ]
