"""
sentry.plugins.bases.notify
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.app import ratelimiter
from sentry.plugins import Notification, Plugin
from sentry.models import UserOption, AccessGroup


class NotificationConfigurationForm(forms.Form):
    pass


class BaseNotificationUserOptionsForm(forms.Form):
    def __init__(self, plugin, user, *args, **kwargs):
        self.plugin = plugin
        self.user = user
        super(BaseNotificationUserOptionsForm, self).__init__(*args, **kwargs)

    def get_title(self):
        return self.plugin.get_conf_title()

    def get_description(self):
        return ""

    def save(self):
        raise NotImplementedError


class NotificationPlugin(Plugin):
    description = _('Notify project members when a new event is seen for the first time, or when an '
                    'already resolved event has changed back to unresolved.')
    # site_conf_form = NotificationConfigurationForm
    project_conf_form = NotificationConfigurationForm

    def notify(self, notification):
        event = notification.event
        return self.notify_users(event.group, event)

    def rule_notify(self, event, futures):
        rules = []
        for future in futures:
            rules.append(future.rule)
            if not future.kwargs:
                continue
            raise NotImplementedError('The default behavior for notification de-duplication does not support args')

        notification = Notification(event=event, rules=rules)
        self.notify(notification)

    def notify_users(self, group, event, fail_silently=False):
        raise NotImplementedError

    def get_sendable_users(self, project):
        conf_key = self.get_conf_key()

        alert_settings = dict(
            (o.user_id, int(o.value))
            for o in UserOption.objects.filter(
                project=project,
                key='%s:alert' % conf_key,
            )
        )

        disabled = set(u for u, v in alert_settings.iteritems() if v == 0)

        # fetch access group members
        member_set = set(AccessGroup.objects.filter(
            projects=project,
            members__is_active=True,
        ).exclude(members__in=disabled).values_list('members', flat=True))

        if project.team:
            # fetch team members
            member_set |= set(project.team.member_set.exclude(
                user__in=disabled,
            ).values_list('user', flat=True))

        # determine members default settings
        members_to_check = set(u for u in member_set if u not in alert_settings)
        if members_to_check:
            disabled = set(UserOption.objects.filter(
                key='subscribe_by_default',
                value='0',
                user__in=members_to_check,
            ).values_list('user', flat=True))
            member_set = filter(lambda x: x not in disabled, member_set)

        return member_set

    def should_notify(self, group, event):
        if group.is_muted():
            return False

        project = group.project

        rate_limited = ratelimiter.is_limited(
            project=project,
            key=self.get_conf_key(),
            limit=15,
        )

        if rate_limited:
            logger = logging.getLogger('sentry.plugins.{0}'.format(self.get_conf_key()))
            logger.info('Notification for project %s dropped due to rate limiting', project.id)

        return not rate_limited

    def test_configuration(self, project):
        from sentry.utils.samples import create_sample_event
        event = create_sample_event(project, default='python')
        return self.notify_users(event.group, event, fail_silently=False)


# Backwards-compatibility
NotifyConfigurationForm = NotificationConfigurationForm
NotifyPlugin = NotificationPlugin
