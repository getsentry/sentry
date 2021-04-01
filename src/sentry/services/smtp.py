import asyncore
import email
import logging
from smtpd import SMTPChannel, SMTPServer

from email_reply_parser import EmailReplyParser

from sentry.services.base import Service
from sentry.tasks.email import process_inbound_email
from sentry.utils.email import email_to_group_id

logger = logging.getLogger(__name__)


# HACK(mattrobenolt): literally no idea what I'm doing. Mostly made this up.
# SMTPChannel doesn't support EHLO response, but nginx requires an EHLO.
# EHLO is available in python 3, so this is backported somewhat
def smtp_EHLO(self, arg):
    if not arg:
        self.push("501 Syntax: EHLO hostname")
        return
    if self._SMTPChannel__greeting:
        self.push("503 Duplicate HELO/EHLO")
    else:
        self._SMTPChannel__greeting = arg
        self.push("250 %s" % self._SMTPChannel__fqdn)


SMTPChannel.smtp_EHLO = smtp_EHLO

STATUS = {200: "200 Ok", 550: "550 Not found", 552: "552 Message too long"}


class SentrySMTPServer(Service, SMTPServer):
    name = "smtp"
    max_message_length = 20000  # This might be too conservative

    def __init__(self, host=None, port=None, debug=False, workers=None):
        from django.conf import settings

        self.host = host or getattr(settings, "SENTRY_SMTP_HOST", "0.0.0.0")
        self.port = port or getattr(settings, "SENTRY_SMTP_PORT", 1025)

    def process_message(self, peer, mailfrom, rcpttos, raw_message):
        logger.info("Incoming message received from %s", mailfrom)
        if not len(rcpttos):
            logger.info("Incoming email had no recipients. Ignoring.")
            return STATUS[550]

        if len(raw_message) > self.max_message_length:
            logger.info("Inbound email message was too long: %d", len(raw_message))
            return STATUS[552]

        try:
            group_id = email_to_group_id(rcpttos[0])
        except Exception:
            logger.info("%r is not a valid email address", rcpttos)
            return STATUS[550]

        message = email.message_from_string(raw_message)
        payload = None
        if message.is_multipart():
            for msg in message.walk():
                if msg.get_content_type() == "text/plain":
                    payload = msg.get_payload()
                    break
            if payload is None:
                # No text/plain part, bailing
                return STATUS[200]
        else:
            payload = message.get_payload()

        payload = EmailReplyParser.parse_reply(payload).strip()
        if not payload:
            # If there's no body, we don't need to go any further
            return STATUS[200]

        process_inbound_email.delay(mailfrom, group_id, payload)
        return STATUS[200]

    def run(self):
        SMTPServer.__init__(self, (self.host, self.port), None)
        try:
            asyncore.loop()
        except KeyboardInterrupt:
            pass
