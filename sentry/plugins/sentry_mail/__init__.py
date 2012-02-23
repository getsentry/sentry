"""
sentry.plugins.sentry_mail
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from sentry.conf import settings
from sentry.plugins import Plugin, register

NOTSET = object()


class MailConfigurationForm(forms.Form):
    send_to = forms.EmailField(max_length=128, widget=forms.TextInput(attrs={
        'placeholder': 'you@example.com',
    }))


@register
class MailProcessor(Plugin):
    title = 'Mail'
    conf_key = 'mail'
    # site_conf_form = MailConfigurationForm
    project_conf_form = MailConfigurationForm

    def __init__(self, min_level=NOTSET, include_loggers=NOTSET, exclude_loggers=NOTSET,
                 send_to=NOTSET, *args, **kwargs):

        super(MailProcessor, self).__init__(*args, **kwargs)

        if min_level is NOTSET:
            min_level = settings.MAIL_LEVEL
        if include_loggers is NOTSET:
            include_loggers = settings.MAIL_INCLUDE_LOGGERS
        if exclude_loggers is NOTSET:
            exclude_loggers = settings.MAIL_EXCLUDE_LOGGERS
        if send_to is NOTSET:
            send_to = ','.join(settings.ADMINS)

        self.min_level = min_level
        self.include_loggers = include_loggers
        self.exclude_loggers = exclude_loggers
        self.send_to = send_to
        self.subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def _send_mail(self, subject, body, html_body=None, project=None, fail_silently=True):
        send_to = self.get_option('send_to', project) or self.send_to
        subject_prefix = self.get_option('subject_prefix', project) or self.subject_prefix

        msg = EmailMultiAlternatives('%s%s' % (subject_prefix, subject), body, settings.SERVER_EMAIL, send_to.split(','))
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

    def mail_admins(self, group, event, fail_silently=True):
        project = group.project

        interface_list = []
        for interface in event.interfaces.itervalues():
            body = interface.to_string(event)
            if not body:
                continue
            interface_list.append((interface.get_title(), body))

        subject = event.message

        if event.site:
            subject = '[%s] %s' % (event.site, subject)

        link = '%s%s' % (settings.URL_PREFIX, group.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'group': group,
            'event': event,
            'link': link,
            'interfaces': interface_list,
        })
        html_body = render_to_string('sentry/emails/error.html', {
            'group': group,
            'event': event,
            'link': link,
            'interfaces': interface_list,
        })

        self._send_mail(
            subject=subject,
            body=body,
            html_body=html_body,
            project=project,
            fail_silently=fail_silently,
        )

    def should_mail(self, group, event):
        project = group.project
        send_to = self.get_option('send_to', project) or self.send_to
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

        self.mail_admins(group, event)
