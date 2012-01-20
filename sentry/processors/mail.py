"""
sentry.processors.mail
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.mail import send_mail
from django.template.loader import render_to_string
from sentry.conf import settings

from .base import Processor

NOTSET = object()


class MailProcessor(Processor):
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
            send_to = settings.ADMINS

        self.min_level = min_level
        self.include_loggers = include_loggers
        self.exclude_loggers = exclude_loggers
        self.send_to = send_to
        self.subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def mail_admins(self, group, event, fail_silently=True):
        interfaces = event.interfaces

        if 'sentry.interfaces.Exception' in interfaces:
            traceback = interfaces['sentry.interfaces.Exception'].to_string(event)
        else:
            traceback = None

        http = interfaces.get('sentry.interfaces.Http')

        if http:
            ip_repr = (http.env.get('REMOTE_ADDR') in settings.INTERNAL_IPS and 'internal' or 'EXTERNAL')
            subject = '%sError (%s IP): %s' % (self.subject_prefix, ip_repr, http.url)
        else:
            subject = '%sError: %s' % (self.subject_prefix, event.message)

        if event.site:
            subject = '[%s] %s' % (event.site, subject)

        link = '%s%s' % (settings.URL_PREFIX, self.get_absolute_url())

        body = render_to_string('sentry/emails/error.txt', {
            'traceback': traceback,
            'group': self,
            'event': event,
            'link': link,
        })

        send_mail(subject, body,
                  settings.SERVER_EMAIL, self.send_to,
                  fail_silently=fail_silently)

    def should_mail(self, group, event):
        if not self.send_to:
            return False
        if int(group.level) < self.min_level:
            return False
        if self.include_loggers is not None and group.logger not in self.include_loggers:
            return False
        if self.exclude_loggers and group.logger in self.exclude_loggers:
            return False
        return True

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        if not is_sample:
            return

        if not self.should_mail(group, event):
            return

        self.mail_admins(group, event)
