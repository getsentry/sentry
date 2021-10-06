import logging
import os
import time
from functools import partial
from operator import attrgetter
from random import randrange
from typing import Iterable, Optional

import lxml
import toronado
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_text

from sentry import options
from sentry.logging import LoggingFormat
from sentry.models import Activity, Group, GroupEmailThread, Project
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.web.helpers import render_to_string

from .address import get_from_email_domain
from .list_resolver import ListResolver
from .manager import get_email_addresses
from .send import send_messages

logger = logging.getLogger("sentry.mail")

default_list_type_handlers = {
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
def make_msgid(domain):
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
    return lxml.html.tostring(tree, doctype="<!DOCTYPE html>", encoding=None).decode("utf-8")


class MessageBuilder:
    def __init__(
        self,
        subject,
        context=None,
        template=None,
        html_template=None,
        body="",
        html_body=None,
        headers=None,
        reference=None,
        reply_reference=None,
        from_email=None,
        type=None,
    ):
        assert not (body and template)
        assert not (html_body and html_template)
        assert context or not (template or html_template)

        if headers is None:
            headers = {}

        self.subject = subject
        self.context = context or {}
        self.template = template
        self.html_template = html_template
        self._txt_body = body
        self._html_body = html_body
        self.headers = headers
        self.reference = reference  # The object that generated this message
        self.reply_reference = reply_reference  # The object this message is replying about
        self.from_email = from_email or options.get("mail.from")
        self._send_to = set()
        self.type = type if type else "generic"

        if reference is not None and "List-Id" not in headers:
            try:
                headers["List-Id"] = make_listid_from_instance(reference)
            except ListResolver.UnregisteredTypeError as error:
                logger.debug(str(error))
            except AssertionError as error:
                logger.warning(str(error))

    def __render_html_body(self) -> str:
        html_body = None
        if self.html_template:
            html_body = render_to_string(self.html_template, self.context)
        else:
            html_body = self._html_body

        if html_body is not None:
            return inline_css(html_body)

    def __render_text_body(self) -> str:
        if self.template:
            return render_to_string(self.template, self.context)
        return self._txt_body

    def add_users(self, user_ids: Iterable[int], project: Optional[Project] = None) -> None:
        self._send_to.update(list(get_email_addresses(user_ids, project).values()))

    def build(self, to, reply_to=None, cc=None, bcc=None):
        if self.headers is None:
            headers = {}
        else:
            headers = self.headers.copy()

        if options.get("mail.enable-replies") and "X-Sentry-Reply-To" in headers:
            reply_to = headers["X-Sentry-Reply-To"]
        else:
            reply_to = set(reply_to or ())
            reply_to.discard(to)
            reply_to = ", ".join(reply_to)

        if reply_to:
            headers.setdefault("Reply-To", reply_to)

        # Every message sent needs a unique message id
        message_id = make_msgid(get_from_email_domain())
        headers.setdefault("Message-Id", message_id)

        subject = force_text(self.subject)

        if self.reply_reference is not None:
            reference = self.reply_reference
            subject = "Re: %s" % subject
        else:
            reference = self.reference

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

    def get_built_messages(self, to=None, cc=None, bcc=None):
        send_to = set(to or ())
        send_to.update(self._send_to)
        results = [
            self.build(to=email, reply_to=send_to, cc=cc, bcc=bcc) for email in send_to if email
        ]
        if not results:
            logger.debug("Did not build any messages, no users to send to.")
        return results

    def format_to(self, to):
        if not to:
            return ""
        if len(to) > MAX_RECIPIENTS:
            to = to[:MAX_RECIPIENTS] + [f"and {len(to[MAX_RECIPIENTS:])} more."]
        return ", ".join(to)

    def send(self, to=None, cc=None, bcc=None, fail_silently=False):
        return send_messages(
            self.get_built_messages(to, cc=cc, bcc=bcc), fail_silently=fail_silently
        )

    def send_async(self, to=None, cc=None, bcc=None):
        from sentry.tasks.email import send_email

        fmt = options.get("system.logging-format")
        messages = self.get_built_messages(to, cc=cc, bcc=bcc)
        extra = {"message_type": self.type}
        loggable = [v for k, v in self.context.items() if hasattr(v, "id")]
        for context in loggable:
            extra["%s_id" % type(context).__name__.lower()] = context.id

        log_mail_queued = partial(logger.info, "mail.queued", extra=extra)
        for message in messages:
            safe_execute(send_email.delay, message=message, _with_transaction=False)
            extra["message_id"] = message.extra_headers["Message-Id"]
            metrics.incr("email.queued", instance=self.type, skip_internal=False)
            if fmt == LoggingFormat.HUMAN:
                extra["message_to"] = (self.format_to(message.to),)
                log_mail_queued()
            elif fmt == LoggingFormat.MACHINE:
                for recipient in message.to:
                    extra["message_to"] = recipient
                    log_mail_queued()
