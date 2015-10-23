"""
sentry.utils.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import time
import toronado
from random import randrange

from django.conf import settings
from django.core.mail import get_connection, EmailMultiAlternatives
from django.core.signing import Signer
from django.utils.encoding import force_bytes
from django.utils.functional import cached_property
from email.utils import parseaddr

from sentry.models import GroupEmailThread, Group
from sentry.web.helpers import render_to_string
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

signer = Signer()

SMTP_HOSTNAME = getattr(settings, 'SENTRY_SMTP_HOSTNAME', 'localhost')
ENABLE_EMAIL_REPLIES = getattr(settings, 'SENTRY_ENABLE_EMAIL_REPLIES', False)


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

    @cached_property
    def html_body(self):
        html_body = None
        if self.html_template:
            html_body = render_to_string(self.html_template, self.context)
        else:
            html_body = self._html_body

        if html_body is not None:
            return inline_css(html_body)

    @cached_property
    def txt_body(self):
        if self.template:
            return render_to_string(self.template, self.context)
        return self._txt_body

    def add_users(self, user_ids, project=None):
        from sentry.models import User, UserOption

        email_list = set()
        user_ids = set(user_ids)

        # XXX: It's possible that options have been set to an empty value
        if project:
            queryset = UserOption.objects.filter(
                project=project,
                user__in=user_ids,
                key='mail:email',
            )
            for option in (o for o in queryset if o.value):
                user_ids.remove(option.user_id)
                email_list.add(option.value)

        if user_ids:
            queryset = UserOption.objects.filter(
                user__in=user_ids,
                key='alert_email',
            )
            for option in (o for o in queryset if o.value):
                try:
                    user_ids.remove(option.user_id)
                    email_list.add(option.value)
                except KeyError:
                    # options.user_id might not exist in user_ids set
                    pass

        if user_ids:
            email_list |= set(filter(bool, User.objects.filter(
                pk__in=user_ids, is_active=True,
            ).values_list('email', flat=True)))

        self._send_to.update(email_list)

    def build(self, to, reply_to=()):
        if self.headers is None:
            headers = {}
        else:
            headers = self.headers.copy()

        if ENABLE_EMAIL_REPLIES and 'X-Sentry-Reply-To' in headers:
            reply_to = headers['X-Sentry-Reply-To']
        else:
            reply_to = set(reply_to)
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
            subject,
            self.txt_body,
            self.from_email,
            (to,),
            headers=headers
        )
        if self.html_body:
            msg.attach_alternative(self.html_body, 'text/html')

        return msg

    def get_built_messages(self, to=None):
        send_to = set(to or ())
        send_to.update(self._send_to)
        return [self.build(to=email, reply_to=send_to) for email in send_to]

    def send(self, to=None, fail_silently=False):
        messages = self.get_built_messages(to)
        self.send_all(messages, fail_silently=fail_silently)

    def send_all(self, messages, fail_silently=False):
        connection = get_connection(fail_silently=fail_silently)
        metrics.incr('email.sent', len(messages))
        return connection.send_messages(messages)

    def send_async(self, to=None):
        from sentry.tasks.email import send_email
        messages = self.get_built_messages(to)
        for message in messages:
            safe_execute(send_email.delay, message=message)


def inline_css(html):
    return toronado.from_string(html)
