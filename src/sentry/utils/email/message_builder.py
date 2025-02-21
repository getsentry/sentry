from __future__ import annotations

import logging
import os
import time
from collections.abc import Callable, Iterable, Mapping, MutableMapping, Sequence
from functools import partial
from operator import attrgetter
from random import randrange
from typing import Any

import lxml.html
import toronado
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_str

from sentry import options
from sentry.db.models import Model
from sentry.logging import LoggingFormat
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupemailthread import GroupEmailThread
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.utils import json, metrics
from sentry.utils.safe import safe_execute
from sentry.web.helpers import render_to_string

from .address import get_from_email_domain
from .list_resolver import ListResolver
from .manager import get_email_addresses
from .send import send_messages

logger = logging.getLogger("sentry.mail")

default_list_type_handlers: Mapping[type[Model], Callable[[Model], Iterable[str]]] = {
    Activity: attrgetter("project.slug", "project.organization.slug"),
    Project: attrgetter("slug", "organization.slug"),
    Group: attrgetter("project.slug", "organization.slug"),
}

make_listid_from_instance = ListResolver(
    options.get("mail.list-namespace"), default_list_type_handlers
)

# The maximum amount of recipients to display in human format.
MAX_RECIPIENTS = 5


# Slightly modified version of Django's `django.core.mail.message:make_msgid`
# because we need to override the domain. If we ever upgrade to django 1.8, we
# can/should replace this.
def make_msgid(domain: str) -> str:
    """Returns a string suitable for RFC 2822 compliant Message-ID, e.g:
    <20020201195627.33539.96671@nightshade.la.mastaler.com>
    Optional idstring if given is a string used to strengthen the
    uniqueness of the message id.  Optional domain if given provides the
    portion of the message id after the '@'.  It defaults to the locally
    defined hostname.
    """
    timeval = time.time()
    utcdate = time.strftime("%Y%m%d%H%M%S", time.gmtime(timeval))
    pid = os.getpid()
    randint = randrange(100000)
    msgid = f"<{utcdate}.{pid}.{randint}@{domain}>"
    return msgid


def inline_css(value: str) -> str:
    tree = lxml.html.document_fromstring(value)
    toronado.inline(tree)
    # CSS media query support is inconsistent when the DOCTYPE declaration is
    # missing, so we force it to HTML5 here.
    html = lxml.html.tostring(tree, doctype="<!DOCTYPE html>", encoding=None).decode("utf-8")
    return html


class MessageBuilder:
    def __init__(
        self,
        subject: str,
        context: Mapping[str, Any] | None = None,
        template: str | None = None,
        html_template: str | None = None,
        body: str = "",
        html_body: str | None = None,
        headers: Mapping[str, str] | None = None,
        reference: Model | None = None,
        from_email: str | None = None,
        type: str | None = None,
    ) -> None:
        assert not (body and template)
        assert not (html_body and html_template)
        assert context or not (template or html_template)

        self.subject = subject
        self.context = context or {}
        self.template = template
        self.html_template = html_template
        self._txt_body = body
        self._html_body = html_body
        self.headers: MutableMapping[str, Any] = {**(headers or {})}
        self.reference = reference  # The object that generated this message
        self.from_email = from_email or options.get("mail.from")
        self._send_to: set[str] = set()
        self.type = type if type else "generic"

        if reference is not None and "List-Id" not in self.headers:
            try:
                self.headers["List-Id"] = make_listid_from_instance(reference)
            except ListResolver.UnregisteredTypeError as error:
                logger.debug(str(error))
            except AssertionError as error:
                logger.warning(str(error))

        # If a "type" is specified, add it to the headers to categorize the emails if not already set
        if type is not None and "X-SMTPAPI" not in self.headers:
            self.headers = {
                "X-SMTPAPI": json.dumps({"category": type}),
                **(self.headers),
            }

    def __render_html_body(self) -> str | None:
        if self.html_template:
            html_body: str | None = render_to_string(self.html_template, self.context)
        else:
            html_body = self._html_body

        if html_body is None:
            return None

        return inline_css(html_body)

    def __render_text_body(self) -> str:
        if self.template:
            body: str = render_to_string(self.template, self.context)
            return body
        return self._txt_body

    def add_users(self, user_ids: Iterable[int], project: Project | None = None) -> None:
        self._send_to.update(list(get_email_addresses(user_ids, project).values()))

    def build(
        self,
        to: str,
        reply_to: Iterable[str] | None = None,
        cc: Sequence[str] | None = None,
        bcc: Sequence[str] | None = None,
    ) -> EmailMultiAlternatives:
        # Create a copy of the existing headers
        headers = {**self.headers}

        # Handle reply-to logic based on mail settings
        if options.get("mail.enable-replies") and "X-Sentry-Reply-To" in headers:
            # If replies are enabled and we have a special Sentry reply-to header,
            # use that as the reply-to address
            reply_to = headers["X-Sentry-Reply-To"]
        else:
            # Otherwise, convert reply_to to a set (or empty set if None)
            # Remove the primary recipient from reply-to addresses to avoid duplicates
            # Join all remaining reply-to addresses with commas
            reply_to = set(reply_to or ())
            reply_to.discard(to)
            reply_to = ", ".join(reply_to)

        # Add Reply-To header if we have reply-to addresses
        # setdefault() only sets the header if it doesn't already exist
        if reply_to:
            headers.setdefault("Reply-To", reply_to)

        # Every message sent needs a unique message id
        message_id = make_msgid(get_from_email_domain())
        headers.setdefault("Message-Id", message_id)

        subject = force_str(self.subject)

        reference = self.reference
        if isinstance(reference, Activity):
            reference = reference.group
            subject = f"Re: {subject}"

        if isinstance(reference, Group):
            thread, created = GroupEmailThread.objects.get_or_create(
                email=to,
                group=reference,
                defaults={"project": reference.project, "msgid": message_id},
            )
            if not created:
                headers.setdefault("In-Reply-To", thread.msgid)
                headers.setdefault("References", thread.msgid)

        msg = EmailMultiAlternatives(
            subject=subject.splitlines()[0],
            body=self.__render_text_body(),
            from_email=self.from_email,
            to=(to,),
            cc=cc or (),
            bcc=bcc or (),
            headers=headers,
        )

        html_body = self.__render_html_body()
        if html_body:
            msg.attach_alternative(html_body, "text/html")

        return msg

    def get_built_messages(
        self,
        to: Iterable[str] | None = None,
        reply_to: Iterable[str] | None = None,
        cc: Sequence[str] | None = None,
        bcc: Sequence[str] | None = None,
    ) -> Sequence[EmailMultiAlternatives]:
        # Create a set from the 'to' parameter, defaulting to empty set if None
        send_to = set(to or ())
        # Add any additional recipients that were previously added via add_users()
        send_to.update(self._send_to)
        # Add all recipients to the reply-to list
        reply_to = send_to.union(reply_to or ())
        # Build individual email messages for each recipient
        # Filters out any empty email addresses and set reply_to
        results = [
            self.build(to=email, reply_to=reply_to, cc=cc, bcc=bcc) for email in send_to if email
        ]
        # Log if no messages were created due to no valid recipients
        if not results:
            logger.debug("Did not build any messages, no users to send to.")
        return results

    def format_to(self, to: list[str]) -> str:
        if not to:
            return ""
        if len(to) > MAX_RECIPIENTS:
            to = to[:MAX_RECIPIENTS] + [f"and {len(to[MAX_RECIPIENTS:])} more."]
        return ", ".join(to)

    def send(
        self,
        to: Iterable[str] | None = None,
        cc: Sequence[str] | None = None,
        bcc: Sequence[str] | None = None,
        fail_silently: bool = False,
    ) -> int:
        return send_messages(
            self.get_built_messages(to, cc=cc, bcc=bcc), fail_silently=fail_silently
        )

    def send_async(
        self,
        to: Iterable[str] | None = None,
        reply_to: Iterable[str] | None = None,
        cc: Sequence[str] | None = None,
        bcc: Sequence[str] | None = None,
    ) -> None:
        """Asynchronously send email messages using Celery tasks.

        Args:
            to: Iterable of recipient email addresses
            reply_to: Iterable of reply-to email addresses
            cc: Sequence of carbon copy email addresses
            bcc: Sequence of blind carbon copy email addresses

        The method:
        1. Builds email messages for each recipient
        2. Sends them asynchronously using Celery tasks
        3. Logs the queued messages and increments metrics
        """
        # Import email tasks here to avoid circular imports
        from sentry.tasks.email import send_email, send_email_control

        # Get logging format preference (human vs machine readable)
        fmt = options.get("system.logging-format")

        # Build all email messages
        messages = self.get_built_messages(to, reply_to, cc=cc, bcc=bcc)

        # Prepare extra logging context
        extra: MutableMapping[str, str | tuple[str]] = {"message_type": self.type}

        # Extract IDs from context objects that have them (for logging)
        loggable = [v for k, v in self.context.items() if hasattr(v, "id")]
        for context in loggable:
            extra[f"{type(context).__name__.lower()}_id"] = context.id

        # Create partial function for logging queued messages
        log_mail_queued = partial(logger.info, "mail.queued", extra=extra)

        # Process each message
        for message in messages:
            # Select appropriate task based on silo mode
            send_email_task = send_email.delay
            if SiloMode.get_current_mode() == SiloMode.CONTROL:
                send_email_task = send_email_control.delay

            # Queue the email task
            safe_execute(send_email_task, message=message)

            # Add message ID to logging context
            extra["message_id"] = message.extra_headers["Message-Id"]

            # Increment email queued metric
            metrics.incr("email.queued", instance=self.type, skip_internal=False)

            # Log based on format preference
            if fmt == LoggingFormat.HUMAN:
                # For human format, log all recipients in a single entry
                extra["message_to"] = (self.format_to(message.to),)
                log_mail_queued()
            elif fmt == LoggingFormat.MACHINE:
                # For machine format, log each recipient separately
                for recipient in message.to:
                    extra["message_to"] = recipient
                    log_mail_queued()
