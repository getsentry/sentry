"""
sentry.plugins.bases.notify
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.utils.translation import ugettext_lazy as _
from sentry.plugins import Plugin
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


class Message(object):
    def __init__(self, short, long):
        self.short = short
        self.long = long


class NotificationPlugin(Plugin):
    description = _('Notify project members when a new event is seen for the first time, or when an '
                    'already resolved event has changed back to unresolved.')
    # site_conf_form = NotificationConfigurationForm
    project_conf_form = NotificationConfigurationForm

    def notify_users(self, group, event, fail_silently=False):
        raise NotImplementedError

    def get_sendable_users(self, project):
        conf_key = self.get_conf_key()

        alert_settings = dict(
            (o.user_id, o.value)
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
            member_set |= set(project.team.member_set.filter(
                user__is_active=True,
            ).exclude(user__in=disabled).values_list('user', flat=True))

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
        project = group.project
        send_to = self.get_sendable_users(project)
        if not send_to:
            return False

        allowed_tags = project.get_option('notifcation:tags', {})
        if allowed_tags:
            tags = event.data.get('tags', ())
            if not tags:
                return False
            if not any(v in allowed_tags.get(k, ()) for k, v in tags):
                return False
        return True

    ## plugin hooks

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        if not is_new:
            return

        if not self.should_notify(group, event):
            return

        self.notify_users(group, event)

# Backwards-compatibility
NotifyConfigurationForm = NotificationConfigurationForm
NotifyPlugin = NotificationPlugin
