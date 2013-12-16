"""
sentry.utils.email
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.signing import Signer
from django.utils.encoding import force_bytes

from pynliner import Pynliner

from sentry.web.helpers import render_to_string

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


class MessageBuilder(object):
    def __init__(self, subject, context=None, template=None, html_template=None,
                 body=None, html_body=None, headers=None):
        assert not (body and template)
        assert not (html_body and html_template)
        assert context or not (template or html_template)

        self.subject = subject
        self.context = context or {}
        self.template = template
        self.html_template = html_template
        self.body = body
        self.html_body = html_body
        self.headers = headers

        self._send_to = set()

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
                user_ids.remove(option.user_id)
                email_list.add(option.value)

        if user_ids:
            email_list |= set(User.objects.filter(
                pk__in=user_ids, is_active=True
            ).values_list('email', flat=True))

        self._send_to.update(email_list)

    def build(self, to=None):
        if self.headers is None:
            headers = {}
        else:
            headers = self.headers.copy()

        send_to = set(to or ())
        send_to.update(self._send_to)

        if ENABLE_EMAIL_REPLIES and 'X-Sentry-Reply-To' in headers:
            reply_to = headers['X-Sentry-Reply-To']
        else:
            reply_to = ', '.join(send_to)

        headers.setdefault('Reply-To', reply_to)

        if self.template:
            txt_body = render_to_string(self.template, self.context)
        else:
            txt_body = self.body

        if self.html_template:
            html_body = render_to_string(self.html_template, self.context)
        else:
            html_body = self.html_body

        msg = EmailMultiAlternatives(
            self.subject,
            txt_body,
            settings.SERVER_EMAIL,
            send_to,
            headers=headers
        )
        if html_body:
            msg.attach_alternative(
                UnicodeSafePynliner().from_string(html_body).run(),
                "text/html")

        return msg

    def send(self, to=None, fail_silently=False):
        msg = self.build(to=to)
        msg.send(fail_silently=fail_silently)


class UnicodeSafePynliner(Pynliner):
    def _get_output(self):
        """
        Generate Unicode string of `self.soup` and set it to `self.output`

        Returns self.output
        """
        self.output = unicode(self.soup)
        return self.output
