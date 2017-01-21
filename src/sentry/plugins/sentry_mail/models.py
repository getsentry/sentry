"""
sentry.plugins.sentry_mail.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import itertools
import logging
import six

import sentry

from django.core.urlresolvers import reverse
from django.utils import dateformat
from django.utils.encoding import force_text
from django.utils.safestring import mark_safe

from sentry import options
from sentry.digests.utilities import get_digest_metadata
from sentry.plugins import register
from sentry.plugins.base.structs import Notification
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils.cache import cache
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

from .activity import emails

NOTSET = object()

logger = logging.getLogger(__name__)


class MailPlugin(NotificationPlugin):
    title = 'Mail'
    conf_key = 'mail'
    slug = 'mail'
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = None
    subject_prefix = None

    def _subject_prefix(self):
        if self.subject_prefix is not None:
            return self.subject_prefix
        return options.get('mail.subject-prefix')

    def _build_message(self, project, subject, template=None, html_template=None,
                   body=None, reference=None, reply_reference=None, headers=None,
                   context=None, send_to=None, type=None):
        if send_to is None:
            send_to = self.get_send_to(project)
        if not send_to:
            logger.debug('Skipping message rendering, no users to send to.')
            return

        subject_prefix = self.get_option('subject_prefix', project) or self._subject_prefix()
        subject_prefix = force_text(subject_prefix)
        subject = force_text(subject)

        msg = MessageBuilder(
            subject='%s%s' % (subject_prefix, subject),
            template=template,
            html_template=html_template,
            body=body,
            headers=headers,
            type=type,
            context=context,
            reference=reference,
            reply_reference=reply_reference,
        )
        msg.add_users(send_to, project=project)
        return msg

    def _send_mail(self, *args, **kwargs):
        message = self._build_message(*args, **kwargs)
        if message is not None:
            return message.send_async()

    def get_notification_settings_url(self):
        return absolute_uri(reverse('sentry-account-settings-notifications'))

    def get_project_url(self, project):
        return absolute_uri('/{}/{}/'.format(project.organization.slug, project.slug))

    def is_configured(self, project, **kwargs):
        # Nothing to configure here
        return True

    def should_notify(self, group, event):
        send_to = self.get_sendable_users(group.project)
        if not send_to:
            return False

        return super(MailPlugin, self).should_notify(group, event)

    def get_send_to(self, project):
        """
        Returns a list of user IDs for the users that should receive
        notifications for the provided project.

        This result may come from cached data.
        """
        if not (project and project.team):
            logger.debug('Tried to send notification to invalid project: %r', project)
            return []

        cache_key = '%s:send_to:%s' % (self.get_conf_key(), project.pk)
        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = [s for s in self.get_sendable_users(project) if s]
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list

    def add_unsubscribe_link(self, context, user_id, project):
        context['unsubscribe_link'] = generate_signed_link(user_id,
            'sentry-account-email-unsubscribe-project', kwargs={
                'project_id': project.id,
            })

    def notify(self, notification):
        event = notification.event
        group = event.group
        project = group.project
        org = group.organization

        subject = event.get_email_subject()

        link = group.get_absolute_url()

        template = 'sentry/emails/error.txt'
        html_template = 'sentry/emails/error.html'

        rules = []
        for rule in notification.rules:
            rule_link = reverse('sentry-edit-project-rule', args=[
                org.slug, project.slug, rule.id
            ])
            rules.append((rule.label, rule_link))

        enhanced_privacy = org.flags.enhanced_privacy

        context = {
            'project_label': project.get_full_name(),
            'group': group,
            'event': event,
            'link': link,
            'rules': rules,
            'enhanced_privacy': enhanced_privacy,
        }

        # if the organization has enabled enhanced privacy controls we dont send
        # data which may show PII or source code
        if not enhanced_privacy:
            interface_list = []
            for interface in six.itervalues(event.interfaces):
                body = interface.to_email_html(event)
                if not body:
                    continue
                text_body = interface.to_string(event)
                interface_list.append(
                    (interface.get_title(), mark_safe(body), text_body)
                )

            context.update({
                'tags': event.get_tags(),
                'interfaces': interface_list,
            })

        headers = {
            'X-Sentry-Logger': group.logger,
            'X-Sentry-Logger-Level': group.get_level_display(),
            'X-Sentry-Team': project.team.name,
            'X-Sentry-Project': project.name,
            'X-Sentry-Reply-To': group_id_to_email(group.id),
        }

        for user_id in self.get_send_to(project):
            self.add_unsubscribe_link(context, user_id, project)
            self._send_mail(
                subject=subject,
                template=template,
                html_template=html_template,
                project=project,
                reference=group,
                headers=headers,
                type='notify.error',
                context=context,
                send_to=[user_id],
            )

    def get_digest_subject(self, project, counts, date):
        return u'[{project}] {count} new {noun} since {date}'.format(
            project=project.get_full_name(),
            count=len(counts),
            noun='alert' if len(counts) == 1 else 'alerts',
            date=dateformat.format(date, 'N j, Y, P e'),
        )

    def notify_digest(self, project, digest):
        start, end, counts = get_digest_metadata(digest)

        # If there is only one group in this digest (regardless of how many
        # rules it appears in), we should just render this using the single
        # notification template. If there is more than one record for a group,
        # just choose the most recent one.
        if len(counts) == 1:
            group = six.next(iter(counts))
            record = max(
                itertools.chain.from_iterable(
                    groups.get(group, []) for groups in six.itervalues(digest),
                ),
                key=lambda record: record.timestamp,
            )
            notification = Notification(record.value.event, rules=record.value.rules)
            return self.notify(notification)

        context = {
            'start': start,
            'end': end,
            'project': project,
            'digest': digest,
            'counts': counts,
        }

        subject = self.get_digest_subject(project, counts, start)

        for user_id in self.get_send_to(project):
            self.add_unsubscribe_link(context, user_id, project)
            self._send_mail(
                subject=subject,
                template='sentry/emails/digests/body.txt',
                html_template='sentry/emails/digests/body.html',
                project=project,
                type='notify.digest',
                context=context,
                send_to=[user_id],
            )

    def notify_about_activity(self, activity):
        email_cls = emails.get(activity.type)
        if not email_cls:
            logger.debug('No email associated with activity type `{}`'.format(
                activity.get_type_display(),
            ))
            return

        email = email_cls(activity)
        email.send()


# Legacy compatibility
MailProcessor = MailPlugin

register(MailPlugin)
