"""
sentry.plugins.sentry_mail.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sentry

from django.conf import settings
from django.core.urlresolvers import reverse
from django.utils.safestring import mark_safe
from django.utils.translation import ugettext_lazy as _

from sentry.plugins import register
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils.cache import cache
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.http import absolute_uri

NOTSET = object()


class MailPlugin(NotificationPlugin):
    title = _('Mail')
    conf_key = 'mail'
    slug = 'mail'
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = None
    subject_prefix = settings.EMAIL_SUBJECT_PREFIX

    def _send_mail(self, subject, template=None, html_template=None, body=None,
                   project=None, group=None, headers=None, context=None):
        send_to = self.get_send_to(project)
        if not send_to:
            return

        subject_prefix = self.get_option('subject_prefix', project) or self.subject_prefix

        msg = MessageBuilder(
            subject='%s%s' % (subject_prefix, subject),
            template=template,
            html_template=html_template,
            body=body,
            headers=headers,
            context=context,
            reference=group,
        )
        msg.add_users(send_to, project=project)
        return msg.send()

    def send_test_mail(self, project=None):
        self._send_mail(
            subject='Test Email',
            body='This email was requested as a test of Sentry\'s outgoing email',
            project=project,
        )

    def get_notification_settings_url(self):
        return absolute_uri(reverse('sentry-account-settings-notifications'))

    def get_project_url(self, project):
        return absolute_uri(reverse('sentry-stream', args=[
            project.organization.slug,
            project.slug,
        ]))

    def on_alert(self, alert):
        project = alert.project
        subject = '[{0} {1}] ALERT: {2}'.format(
            project.team.name.encode('utf-8'),
            project.name.encode('utf-8'),
            alert.message.encode('utf-8'),
        )
        template = 'sentry/emails/alert.txt'
        html_template = 'sentry/emails/alert.html'

        context = {
            'alert': alert,
            'link': alert.get_absolute_url(),
        }

        headers = {
            'X-Sentry-Project': project.name,
        }

        self._send_mail(
            subject=subject,
            template=template,
            html_template=html_template,
            project=project,
            headers=headers,
            context=context,
        )

    def should_notify(self, group, event):
        send_to = self.get_sendable_users(group.project)
        if not send_to:
            return False

        return super(MailPlugin, self).should_notify(group, event)

    def get_send_to(self, project=None):
        """
        Returns a list of email addresses for the users that should be notified of alerts.

        The logic for this is a bit complicated, but it does the following:

        The results of this call can be fairly expensive to calculate, so the send_to list gets cached
        for 60 seconds.
        """
        if project:
            project_id = project.pk
        else:
            project_id = ''

        if not (project and project.team):
            return []

        conf_key = self.get_conf_key()
        cache_key = '%s:send_to:%s' % (conf_key, project_id)

        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = self.get_sendable_users(project)

            send_to_list = filter(bool, send_to_list)
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list

    def notify(self, notification):
        event = notification.event
        group = event.group
        project = group.project

        interface_list = []
        for interface in event.interfaces.itervalues():
            body = interface.to_email_html(event)
            if not body:
                continue
            interface_list.append((interface.get_title(), mark_safe(body)))

        subject = group.get_email_subject()

        link = group.get_absolute_url()

        template = 'sentry/emails/error.txt'
        html_template = 'sentry/emails/error.html'

        rules = []
        for rule in notification.rules:
            rule_link = reverse('sentry-edit-project-rule', args=[
                group.organization.slug, project.slug, rule.id
            ])
            rules.append((rule.label, rule_link))

        context = {
            'group': group,
            'event': event,
            'tags': event.get_tags(),
            'link': link,
            'interfaces': interface_list,
            'rules': rules,
        }

        headers = {
            'X-Sentry-Logger': group.logger,
            'X-Sentry-Logger-Level': group.get_level_display(),
            'X-Sentry-Team': project.team.name,
            'X-Sentry-Project': project.name,
            'X-Sentry-Reply-To': group_id_to_email(group.id),
        }

        self._send_mail(
            subject=subject,
            template=template,
            html_template=html_template,
            project=project,
            group=group,
            headers=headers,
            context=context,
        )


# Legacy compatibility
MailProcessor = MailPlugin

register(MailPlugin)
