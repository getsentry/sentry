"""
sentry.utils.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import logging
import os
import time
from email.utils import parseaddr
from random import randrange

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.signing import BadSignature, Signer
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str, force_text
from toronado import from_string as inline_css

from sentry.models import Group, GroupEmailThread, User, UserOption
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.web.helpers import render_to_string

logger = logging.getLogger(__name__)

SMTP_HOSTNAME = getattr(settings, 'SENTRY_SMTP_HOSTNAME', 'localhost')
ENABLE_EMAIL_REPLIES = getattr(settings, 'SENTRY_ENABLE_EMAIL_REPLIES', False)


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
    address = address.split('@', 1)[0]
    signed_data = address.replace('+', ':')
    return int(force_bytes(signer.unsign(signed_data)))


def group_id_to_email(group_id):
    signed_data = signer.sign(str(group_id))
    return '@'.join((signed_data.replace(':', '+'), SMTP_HOSTNAME))


def domain_from_email(email):
    email = parseaddr(email)[1]
    try:
        return email.split('@', 1)[1]
    except IndexError:
        # The email address is likely malformed or something
        return email


# Slightly modified version of Django's
# `django.core.mail.message:make_msgid` becuase we need
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
    utcdate = time.strftime('%Y%m%d%H%M%S', time.gmtime(timeval))
    pid = os.getpid()
    randint = randrange(100000)
    msgid = '<%s.%s.%s@%s>' % (utcdate, pid, randint, domain)
    return msgid


FROM_EMAIL_DOMAIN = domain_from_email(settings.DEFAULT_FROM_EMAIL)


def get_email_addresses(user_ids, project=None):
    pending = set(user_ids)
    results = {}

    if project:
        queryset = UserOption.objects.filter(
            project=project,
            user__in=pending,
            key='mail:email',
        )
        for option in (o for o in queryset if o.value):
            results[option.user_id] = option.value
            pending.discard(option.user_id)

    if pending:
        queryset = UserOption.objects.filter(
            user__in=pending,
            key='alert_email',
        )
        for option in (o for o in queryset if o.value):
            results[option.user_id] = option.value
            pending.discard(option.user_id)

    if pending:
        queryset = User.objects.filter(pk__in=pending, is_active=True)
        for (user_id, email) in queryset.values_list('id', 'email'):
            if email:
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning('Could not resolve email addresses for user IDs in %r, discarding...', pending)

    return results


class MessageBuilder(object):
    def __init__(self, subject, context=None, template=None, html_template=None,
                 body=None, html_body=None, headers=None, reference=None,
                 reply_reference=None, from_email=None):
        assert not (body and template)
        assert not (html_body and html_template)
        assert context or not (template or html_template)

        self.subject = subject
        self.context = context or {}
        self.template = template
        self.html_template = html_template
        self._txt_body = body
        self._html_body = html_body
        self.headers = headers
        self.reference = reference  # The object that generated this message
        self.reply_reference = reply_reference  # The object this message is replying about
        self.from_email = from_email or settings.SERVER_EMAIL
        self._send_to = set()

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
        self._send_to.update(
            get_email_addresses(user_ids, project).values()
        )

    def build(self, to, reply_to=None, cc=None, bcc=None):
        if self.headers is None:
            headers = {}
        else:
            headers = self.headers.copy()

        if ENABLE_EMAIL_REPLIES and 'X-Sentry-Reply-To' in headers:
            reply_to = headers['X-Sentry-Reply-To']
        else:
            reply_to = set(reply_to or ())
            reply_to.remove(to)
            reply_to = ', '.join(reply_to)

        if reply_to:
            headers.setdefault('Reply-To', reply_to)

        # Every message sent needs a unique message id
        message_id = make_msgid(FROM_EMAIL_DOMAIN)
        headers.setdefault('Message-Id', message_id)

        subject = self.subject

        if self.reply_reference is not None:
            reference = self.reply_reference
            subject = 'Re: %s' % subject
        else:
            reference = self.reference

        if isinstance(reference, Group):
            thread, created = GroupEmailThread.objects.get_or_create(
                email=to,
                group=reference,
                defaults={
                    'project': reference.project,
                    'msgid': message_id,
                },
            )
            if not created:
                headers.setdefault('In-Reply-To', thread.msgid)
                headers.setdefault('References', thread.msgid)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=self.__render_text_body(),
            from_email=self.from_email,
            to=(to,),
            cc=cc or (),
            bcc=bcc or (),
            headers=headers,
        )

        html_body = self.__render_html_body()
        if html_body:
            msg.attach_alternative(html_body, 'text/html')

        return msg

    def get_built_messages(self, to=None, bcc=None):
        send_to = set(to or ())
        send_to.update(self._send_to)
        results = [self.build(to=email, reply_to=send_to, bcc=bcc) for email in send_to]
        if not results:
            logger.debug('Did not build any messages, no users to send to.')
        return results

    def send(self, to=None, bcc=None, fail_silently=False):
        return send_messages(
            self.get_built_messages(to, bcc=bcc),
            fail_silently=fail_silently,
        )

    def send_async(self, to=None, bcc=None):
        from sentry.tasks.email import send_email
        messages = self.get_built_messages(to, bcc=bcc)
        for message in messages:
            safe_execute(send_email.delay, message=message)


def send_messages(messages, fail_silently=False):
    connection = get_connection(fail_silently=fail_silently)
    metrics.incr('email.sent', len(messages))
    return connection.send_messages(messages)
