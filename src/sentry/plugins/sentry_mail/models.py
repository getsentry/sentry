"""
sentry.plugins.sentry_mail.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import itertools
import logging

import sentry

from django.core.urlresolvers import reverse
from django.template.loader import render_to_string
from django.utils.encoding import force_text
from django.utils.safestring import mark_safe

from sentry import options
from sentry.digests.utilities import get_digest_metadata
from sentry.models import (
    Activity,
    Release,
    UserOption,
)
from sentry.plugins import register
from sentry.plugins.base.structs import Notification
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils.cache import cache
from sentry.utils.email import MessageBuilder, group_id_to_email
from sentry.utils.http import absolute_uri

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

    def _build_message(self, project, subject, template=None, html_template=None, body=None,
                   reference=None, reply_reference=None, headers=None, context=None, send_to=None):
        send_to = send_to or self.get_send_to(project)
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
            context=context,
            reference=reference,
            reply_reference=reply_reference,
        )
        msg.add_users(send_to, project=project)
        return msg

    def _send_mail(self, *args, **kwargs):
        message = self._build_message(*args, **kwargs)
        if message is not None:
            return message.send()

    def get_notification_settings_url(self):
        return absolute_uri(reverse('sentry-account-settings-notifications'))

    def get_project_url(self, project):
        return absolute_uri(reverse('sentry-stream', args=[
            project.organization.slug,
            project.slug,
        ]))

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
            send_to_list = filter(bool, self.get_sendable_users(project))
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache

        return send_to_list

    def notify(self, notification):
        event = notification.event
        group = event.group
        project = group.project
        org = group.organization

        subject = group.get_email_subject()

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
            for interface in event.interfaces.itervalues():
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

        self._send_mail(
            subject=subject,
            template=template,
            html_template=html_template,
            project=project,
            reference=group,
            headers=headers,
            context=context,
        )

    def notify_digest(self, project, digest):
        start, end, counts = get_digest_metadata(digest)

        # If there is only one group in this digest (regardless of how many
        # rules it appears in), we should just render this using the single
        # notification template. If there is more than one record for a group,
        # just choose the most recent one.
        if len(counts) == 1:
            group = counts.keys()[0]
            record = max(
                itertools.chain.from_iterable(
                    groups.get(group, []) for groups in digest.itervalues(),
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

        self._send_mail(
            subject=render_to_string('sentry/emails/digests/subject.txt', context).rstrip(),
            template='sentry/emails/digests/body.txt',
            html_template='sentry/emails/digests/body.html',
            project=project,
            context=context,
        )

    def notify_about_activity(self, activity):
        if activity.type not in (Activity.NOTE, Activity.ASSIGNED, Activity.RELEASE):
            return

        candidate_ids = set(self.get_send_to(activity.project))

        # Never send a notification to the user that performed the action.
        candidate_ids.discard(activity.user_id)

        if activity.type == Activity.ASSIGNED:
            # Only notify the assignee, and only if they are in the candidate set.
            recipient_ids = candidate_ids & set(map(int, (activity.data['assignee'],)))
        elif activity.type == Activity.NOTE:
            recipient_ids = candidate_ids - set(
                UserOption.objects.filter(
                    user__in=candidate_ids,
                    key='subscribe_notes',
                    value=u'0',
                ).values_list('user', flat=True)
            )
        else:
            recipient_ids = candidate_ids

        if not recipient_ids:
            return

        project = activity.project
        org = project.organization
        group = activity.group

        headers = {}

        context = {
            'data': activity.data,
            'author': activity.user,
            'project': project,
            'project_link': absolute_uri(reverse('sentry-stream', kwargs={
                'organization_slug': org.slug,
                'project_id': project.slug,
            })),
        }

        if group:
            group_link = absolute_uri('/{}/{}/issues/{}/'.format(
                org.slug, project.slug, group.id
            ))
            activity_link = '{}activity/'.format(group_link)

            headers.update({
                'X-Sentry-Reply-To': group_id_to_email(group.id),
            })

            context.update({
                'group': group,
                'link': group_link,
                'activity_link': activity_link,
            })

        # TODO(dcramer): abstract each activity email into its own helper class
        if activity.type == Activity.RELEASE:
            context.update({
                'release': Release.objects.get(
                    version=activity.data['version'],
                    project=project,
                ),
                'release_link': absolute_uri('/{}/{}/releases/{}/'.format(
                    org.slug,
                    project.slug,
                    activity.data['version'],
                )),
            })

        template_name = activity.get_type_display()

        if group:
            subject = group.get_email_subject()
        elif activity.type == Activity.RELEASE:
            subject = 'Release %s' % activity.data['version']
        else:
            raise NotImplementedError

        self._send_mail(
            project=project,
            send_to=recipient_ids,
            subject=subject,
            context=context,
            template='sentry/emails/activity/{}.txt'.format(template_name),
            html_template='sentry/emails/activity/{}.html'.format(template_name),
            headers=headers,
            reference=activity,
            reply_reference=group,
        )


# Legacy compatibility
MailProcessor = MailPlugin

register(MailPlugin)
