from __future__ import absolute_import

import logging
import os
import six
import subprocess
import tempfile
import time

from email.utils import parseaddr
from functools import partial
from operator import attrgetter
from random import randrange

import lxml
import toronado
from django.conf import settings
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.core.mail.backends.base import BaseEmailBackend
from django.core.signing import BadSignature, Signer
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str, force_text

from sentry import options
from sentry.logging import LoggingFormat
from sentry.models import Activity, Group, GroupEmailThread, Project, User, UserOption
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.utils.strings import is_valid_dot_atom
from sentry.web.helpers import render_to_string
from sentry.utils.compat import map

# The maximum amount of recipients to display in human format.
MAX_RECIPIENTS = 5

# The fake TLD used to construct email addresses when one is required,
# for example by automatically generated SSO accounts.
FAKE_EMAIL_TLD = ".sentry-fake"

logger = logging.getLogger("sentry.mail")


def inline_css(value):
    tree = lxml.html.document_fromstring(value)
    toronado.inline(tree)
    # CSS media query support is inconsistent when the DOCTYPE declaration is
    # missing, so we force it to HTML5 here.
    return lxml.html.tostring(tree, doctype="<!DOCTYPE html>")


class _CaseInsensitiveSigner(Signer):
    """
    Generate a signature that is comprised of only lowercase letters.

    WARNING: Do not use this for anything that needs to be cryptographically
    secure! This is losing entropy and has a much higher chance of collision
    due to dropping to lowercase letters. For our purposes, this lack of entropy
    is ok and doesn't pose a risk.

    NOTE: This is needed strictly for signatures used in email addresses. Some
    clients, coughAirmailcough, treat email addresses as being case-insensitive,
    and sends the value as all lowercase.
    """

    def signature(self, value):
        sig = super(_CaseInsensitiveSigner, self).signature(value)
        return sig.lower()

    def unsign(self, signed_value):
        # This unsign is identical to subclass except for the lowercasing
        # See: https://github.com/django/django/blob/1.6.11/django/core/signing.py#L165-L172
        signed_value = force_str(signed_value)
        if self.sep not in signed_value:
            raise BadSignature('No "%s" found in value' % self.sep)
        value, sig = signed_value.rsplit(self.sep, 1)
        if constant_time_compare(sig.lower(), self.signature(value)):
            return force_text(value)
        raise BadSignature('Signature "%s" does not match' % sig)


signer = _CaseInsensitiveSigner()


def email_to_group_id(address):
    """
    Email address should be in the form of:
        {group_id}+{signature}@example.com
    """
    address = address.split("@", 1)[0]
    signed_data = address.replace("+", ":")
    return int(force_bytes(signer.unsign(signed_data)))


def group_id_to_email(group_id):
    signed_data = signer.sign(six.text_type(group_id))
    return "@".join(
        (
            signed_data.replace(":", "+"),
            options.get("mail.reply-hostname") or get_from_email_domain(),
        )
    )


def domain_from_email(email):
    email = parseaddr(email)[1]
    try:
        return email.split("@", 1)[1]
    except IndexError:
        # The email address is likely malformed or something
        return email


# Slightly modified version of Django's
# `django.core.mail.message:make_msgid` because we need
# to override the domain. If we ever upgrade to
# django 1.8, we can/should replace this.
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
    msgid = "<%s.%s.%s@%s>" % (utcdate, pid, randint, domain)
    return msgid


# cache the domain_from_email calculation
# This is just a tuple of (email, email-domain)
_from_email_domain_cache = (None, None)


def get_from_email_domain():
    global _from_email_domain_cache
    from_ = options.get("mail.from")
    if not _from_email_domain_cache[0] == from_:
        _from_email_domain_cache = (from_, domain_from_email(from_))
    return _from_email_domain_cache[1]


def create_fake_email(unique_id, namespace):
    """
    Generate a fake email of the form: {unique_id}@{namespace}{FAKE_EMAIL_TLD}

    For example: c74e5b75-e037-4e75-ad27-1a0d21a6b203@cloudfoundry.sentry-fake
    """
    return u"{}@{}{}".format(unique_id, namespace, FAKE_EMAIL_TLD)


def is_fake_email(email):
    """
    Returns True if the provided email matches the fake email pattern.
    """
    return email.endswith(FAKE_EMAIL_TLD)


def get_email_addresses(user_ids, project=None):
    pending = set(user_ids)
    results = {}

    if project:
        queryset = UserOption.objects.filter(project=project, user__in=pending, key="mail:email")
        for option in (o for o in queryset if o.value and not is_fake_email(o.value)):
            results[option.user_id] = option.value
            pending.discard(option.user_id)

    if pending:
        queryset = User.objects.filter(pk__in=pending, is_active=True)
        for (user_id, email) in queryset.values_list("id", "email"):
            if email and not is_fake_email(email):
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning(
            "Could not resolve email addresses for user IDs in %r, discarding...", pending
        )

    return results


class ListResolver(object):
    """
    Manages the generation of RFC 2919 compliant list-id strings from varying
    objects types.
    """

    class UnregisteredTypeError(Exception):
        """
        Error raised when attempting to build a list-id from an unregisted object type.
        """

    def __init__(self, namespace, type_handlers):
        assert is_valid_dot_atom(namespace)

        # The list-id-namespace that will be used when generating the list-id
        # string. This should be a domain name under the control of the
        # generator (see RFC 2919.)
        self.__namespace = namespace

        # A mapping of classes to functions that accept an instance of that
        # class, returning a tuple of values that will be used to generate the
        # list label. Returned values must be valid RFC 2822 dot-atom-text
        # values.
        self.__type_handlers = type_handlers

    def __call__(self, instance):
        """
        Build a list-id string from an instance.

        Raises ``UnregisteredTypeError`` if there is no registered handler for
        the instance type. Raises ``AssertionError`` if a valid list-id string
        cannot be generated from the values returned by the type handler.
        """
        try:
            handler = self.__type_handlers[type(instance)]
        except KeyError:
            raise self.UnregisteredTypeError(
                u"Cannot generate mailing list identifier for {!r}".format(instance)
            )

        label = ".".join(map(six.text_type, handler(instance)))
        assert is_valid_dot_atom(label)

        return u"<{}.{}>".format(label, self.__namespace)


default_list_type_handlers = {
    Activity: attrgetter("project.slug", "project.organization.slug"),
    Project: attrgetter("slug", "organization.slug"),
    Group: attrgetter("project.slug", "organization.slug"),
}

make_listid_from_instance = ListResolver(
    options.get("mail.list-namespace"), default_list_type_handlers
)


class MessageBuilder(object):
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
                logger.debug(six.text_type(error))
            except AssertionError as error:
                logger.warning(six.text_type(error))

    def __render_html_body(self):
        html_body = None
        if self.html_template:
            html_body = render_to_string(self.html_template, self.context)
        else:
            html_body = self._html_body

        if html_body is not None:
            return inline_css(html_body)

    def __render_text_body(self):
        if self.template:
            return render_to_string(self.template, self.context)
        return self._txt_body

    def add_users(self, user_ids, project=None):
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
            msg.attach_alternative(html_body.decode("utf-8"), "text/html")

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
            to = to[:MAX_RECIPIENTS] + [u"and {} more.".format(len(to[MAX_RECIPIENTS:]))]
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
        loggable = [v for k, v in six.iteritems(self.context) if hasattr(v, "id")]
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


def send_messages(messages, fail_silently=False):
    connection = get_connection(fail_silently=fail_silently)
    sent = connection.send_messages(messages)
    metrics.incr("email.sent", len(messages), skip_internal=False)
    for message in messages:
        extra = {
            "message_id": message.extra_headers["Message-Id"],
            "size": len(message.message().as_bytes()),
        }
        logger.info("mail.sent", extra=extra)
    return sent


def get_mail_backend():
    backend = options.get("mail.backend")
    try:
        return settings.SENTRY_EMAIL_BACKEND_ALIASES[backend]
    except KeyError:
        return backend


def get_connection(fail_silently=False):
    """
    Gets an SMTP connection using our OptionsStore
    """
    return mail.get_connection(
        backend=get_mail_backend(),
        host=options.get("mail.host"),
        port=options.get("mail.port"),
        username=options.get("mail.username"),
        password=options.get("mail.password"),
        use_tls=options.get("mail.use-tls"),
        timeout=options.get("mail.timeout"),
        fail_silently=fail_silently,
    )


def send_mail(subject, message, from_email, recipient_list, fail_silently=False, **kwargs):
    """
    Wrapper that forces sending mail through our connection.
    Uses EmailMessage class which has more options than the simple send_mail
    """
    email = mail.EmailMessage(
        subject,
        message,
        from_email,
        recipient_list,
        connection=get_connection(fail_silently=fail_silently),
        **kwargs
    )
    return email.send(fail_silently=fail_silently)


def is_smtp_enabled(backend=None):
    """
    Check if the current backend is SMTP based.
    """
    if backend is None:
        backend = get_mail_backend()
    return backend not in settings.SENTRY_SMTP_DISABLED_BACKENDS


class PreviewBackend(BaseEmailBackend):
    """
    Email backend that can be used in local development to open messages in the
    local mail client as they are sent.

    Probably only works on OS X.
    """

    def send_messages(self, email_messages):
        for message in email_messages:
            content = six.binary_type(message.message())
            preview = tempfile.NamedTemporaryFile(
                delete=False, prefix="sentry-email-preview-", suffix=".eml"
            )
            try:
                preview.write(content)
                preview.flush()
            finally:
                preview.close()

            subprocess.check_call(("open", preview.name))

        return len(email_messages)
