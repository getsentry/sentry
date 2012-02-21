"""
sentry.plugins.sentry_mail
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.core.mail import send_mail
from django.core.validators import email_re, ValidationError
from django.template.loader import render_to_string
from sentry.conf import settings
from sentry.plugins import Plugin, register
import re

split_re = re.compile(r'\s*,\s*|\s+')

NOTSET = object()

class MailConfigurationForm(forms.Form):
    send_to = forms.CharField(required=False,
        help_text='Enter one or more emails separated by commas or lines. '\
                  'Entering emails will prevent messages being sent to '\
                  'project members.',
        widget=forms.Textarea(attrs={
            'placeholder': 'you@example.com, \nother@example.com',}))
    send_to_admins = forms.BooleanField(initial=False, required=False,
        help_text='Send emails to admins as well as members (or emails above).')

    def clean_send_to(self):
        value = self.cleaned_data['send_to']
        emails = filter(None, split_re.split(value))
        for email in emails:
            if not email_re.match(email):
                raise ValidationError('%s is not a valid e-mail address.' % email)
        return ','.join(emails)

@register
class MailProcessor(Plugin):
    title = 'Mail'
    conf_key = 'mail'
    # site_conf_form = MailConfigurationForm
    project_conf_form = MailConfigurationForm

    def __init__(self, min_level=NOTSET, include_loggers=NOTSET, exclude_loggers=NOTSET,
                 send_to=None, send_to_admins=NOTSET, *args, **kwargs):

        super(MailProcessor, self).__init__(*args, **kwargs)

        if min_level is NOTSET:
            min_level = settings.MAIL_LEVEL
        if include_loggers is NOTSET:
            include_loggers = settings.MAIL_INCLUDE_LOGGERS
        if exclude_loggers is NOTSET:
            exclude_loggers = settings.MAIL_EXCLUDE_LOGGERS
        if send_to_admins is NOTSET:
            send_to_admins = False

        self.min_level = min_level
        self.include_loggers = include_loggers
        self.exclude_loggers = exclude_loggers
        self.send_to = send_to
        self.send_to_admins = send_to_admins
        self.subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def _send_mail(self, subject, body, project=None, fail_silently=True):
        send_to = self.get_send_to(project)

        subject_prefix = self.get_option('subject_prefix', project) or self.subject_prefix

        send_mail('%s%s' % (subject_prefix, subject), body,
                  settings.SERVER_EMAIL, send_to,
                  fail_silently=fail_silently)

    def get_send_to(self, project=None):
        send_to_list = self.get_option('send_to', project)
        if not send_to_list:
            if self.send_to is not None:
                send_to_list = self.send_to
            elif project is not None:
                send_to_list = project.member_set.values_list('user__email', flat=True)
            else:
                send_to_list = []

        if isinstance(send_to_list, basestring):
            send_to_list = send_to_list.split(',')

        send_to_admins = self.get_option('send_to_admins', project)
        if send_to_admins is None:
            send_to_admins = self.send_to_admins
        if send_to_admins:
            send_to_list = set(list(send_to_list) + list(settings.ADMINS))

        return filter(None, send_to_list)

    def send_test_mail(self, project=None):
        self._send_mail(
            subject='Test Email',
            body='This email was requested as a test of Sentry\'s outgoing email',
            project=project,
            fail_silently=False,
        )

    def mail_members(self, group, event, fail_silently=True):
        interfaces = event.interfaces

        project = group.project

        if 'sentry.interfaces.Exception' in interfaces:
            traceback = interfaces['sentry.interfaces.Exception'].to_string(event)
        else:
            traceback = None

        http = interfaces.get('sentry.interfaces.Http')

        if http:
            ip_repr = (http.env.get('REMOTE_ADDR') in settings.INTERNAL_IPS and 'internal' or 'EXTERNAL')
            subject = 'Error (%s IP): %s' % (ip_repr, http.url)
        else:
            subject = 'Error: %s' % (event.message,)

        if event.site:
            subject = '[%s] %s' % (event.site, subject)

        link = '%s%s' % (settings.URL_PREFIX, group.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'traceback': traceback,
            'group': self,
            'event': event,
            'link': link,
        })

        self._send_mail(subject, body, project, fail_silently=fail_silently)

    def should_mail(self, group, event):
        project = group.project
        send_to = self.get_send_to(project)
        if not send_to:
            return False
        min_level = self.get_option('min_level', project) or self.min_level
        if min_level is not None and int(group.level) < min_level:
            return False
        include_loggers = self.get_option('include_loggers', project) or self.include_loggers
        if include_loggers is not None and group.logger not in include_loggers:
            return False
        exclude_loggers = self.get_option('exclude_loggers', project) or self.exclude_loggers
        if exclude_loggers and group.logger in exclude_loggers:
            return False
        return True

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        if not is_new:
            return

        if not self.should_mail(group, event):
            return

        self.mail_members(group, event)
