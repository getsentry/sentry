"""
sentry.plugins.sentry_mail.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django import forms
from django.core.mail import EmailMultiAlternatives
from django.core.validators import email_re, ValidationError
from django.template.loader import render_to_string
from django.utils.translation import ugettext_lazy as _
from sentry.conf import settings
from sentry.plugins import register
from sentry.plugins.bases.notify import NotificationPlugin, NotificationConfigurationForm
from sentry.utils.cache import cache

import re

from pynliner import Pynliner

NOTSET = object()
split_re = re.compile(r'\s*,\s*|\s+')


class UnicodeSafePynliner(Pynliner):
    def _get_output(self):
        """
        Generate Unicode string of `self.soup` and set it to `self.output`

        Returns self.output
        """
        self.output = unicode(self.soup)
        return self.output


class MailConfigurationForm(NotificationConfigurationForm):
    send_to = forms.CharField(label=_('Send to'), required=False,
        help_text=_('Enter one or more emails separated by commas or lines.'),
        widget=forms.Textarea(attrs={
            'placeholder': 'you@example.com\nother@example.com'}))

    def clean_send_to(self):
        value = self.cleaned_data['send_to']
        emails = filter(bool, split_re.split(value))
        for email in emails:
            if not email_re.match(email):
                raise ValidationError('%s is not a valid e-mail address.' % (email,))
        return ','.join(emails)


class MailProcessor(NotificationPlugin):
    title = _('Mail')
    conf_key = 'mail'
    slug = 'mail'
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = MailConfigurationForm

    def __init__(self, min_level=NOTSET, include_loggers=NOTSET, exclude_loggers=NOTSET,
                 send_to=None, send_to_members=NOTSET, *args, **kwargs):

        super(MailProcessor, self).__init__(*args, **kwargs)

        if min_level is NOTSET:
            min_level = settings.MAIL_LEVEL
        if include_loggers is NOTSET:
            include_loggers = settings.MAIL_INCLUDE_LOGGERS
        if exclude_loggers is NOTSET:
            exclude_loggers = settings.MAIL_EXCLUDE_LOGGERS
        if send_to_members is NOTSET:
            send_to_members = True

        self.min_level = min_level
        self.include_loggers = include_loggers
        self.exclude_loggers = exclude_loggers
        self.send_to = send_to
        self.send_to_members = send_to_members
        self.subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def _send_mail(self, subject, body, html_body=None, project=None, fail_silently=False, headers=None):
        send_to = self.get_send_to(project)
        if not send_to:
            return

        subject_prefix = self.get_option('subject_prefix', project) or self.subject_prefix

        msg = EmailMultiAlternatives(
            '%s%s' % (subject_prefix, subject),
            body,
            settings.SERVER_EMAIL,
            send_to,
            headers=headers)
        if html_body:
            msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=fail_silently)

    def send_test_mail(self, project=None):
        self._send_mail(
            subject='Test Email',
            body='This email was requested as a test of Sentry\'s outgoing email',
            project=project,
            fail_silently=False,
        )

    def get_send_to(self, project=None):
        """
        Returns a list of email addresses for the users that should be notified of alerts.

        The logic for this is a bit complicated, but it does the following:

        - Includes members if ``send_to_members`` is enabled **and** the user has not disabled alerts
          for this project

        The results of this call can be fairly expensive to calculate, so the send_to list gets cached
        for 60 seconds.
        """
        if project:
            project_id = project.pk
        else:
            project_id = ''
        conf_key = self.get_conf_key()
        cache_key = '%s:send_to:%s' % (conf_key, project_id)

        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = self.get_option('send_to', project) or []

            if isinstance(send_to_list, basestring):
                send_to_list = [s.strip() for s in send_to_list.split(',')]

            send_to_list = set(send_to_list)

            send_to_members = self.get_option('send_to_members', project)
            if send_to_members and project and project.team:
                member_set = self.get_sendable_users(project)
                send_to_list |= set(self.get_emails_for_users(member_set))

            send_to_list = set(s for s in send_to_list if s)

            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list

    def notify_users(self, group, event, fail_silently=False):
        project = group.project

        interface_list = []
        for interface in event.interfaces.itervalues():
            body = interface.to_string(event)
            if not body:
                continue
            interface_list.append((interface.get_title(), body))

        subject = '[%s] %s: %s' % (project.name.encode('utf-8'), event.get_level_display().upper().encode('utf-8'),
            event.error().encode('utf-8').splitlines()[0])

        link = '%s/%s/group/%d/' % (settings.URL_PREFIX, group.project.slug, group.id)

        body = render_to_string('sentry/emails/error.txt', {
            'group': group,
            'event': event,
            'link': link,
            'interfaces': interface_list,
        })
        html_body = UnicodeSafePynliner().from_string(render_to_string('sentry/emails/error.html', {
            'group': group,
            'event': event,
            'link': link,
            'interfaces': interface_list,
        })).run()
        headers = {
            'X-Sentry-Logger': event.logger,
            'X-Sentry-Logger-Level': event.get_level_display(),
            'X-Sentry-Project': project.name,
            'X-Sentry-Server': event.server_name,
        }

        self._send_mail(
            subject=subject,
            body=body,
            html_body=html_body,
            project=project,
            fail_silently=fail_silently,
            headers=headers,
        )

    def get_option(self, key, *args, **kwargs):
        value = super(MailProcessor, self).get_option(key, *args, **kwargs)
        if value is None and key in ('min_level', 'include_loggers', 'exclude_loggers',
                                     'send_to_members', 'send_to',
                                     'subject_prefix'):
            value = getattr(self, key)
        return value

register(MailProcessor)
