"""
sentry.plugins.bases.notify
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.utils.translation import ugettext_lazy as _
from sentry.plugins import Plugin
from sentry.models import UserOption, User, AccessGroup
from sentry.utils.cache import cache


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

        disabled = set(UserOption.objects.filter(
            project=project,
            key='%s:alert' % conf_key,
            value=0,
        ).values_list('user', flat=True))

        # fetch team members
        member_set = set(project.team.member_set.filter(
            user__is_active=True,
        ).exclude(user__in=disabled).values_list('user', flat=True))

        # fetch access group members
        member_set |= set(AccessGroup.objects.filter(
            projects=project,
            members__is_active=True,
        ).exclude(members__in=disabled).values_list('members', flat=True))

        return member_set

    def get_emails_for_users(self, user_ids, project=None):
        email_list = set()
        user_ids = set(user_ids)

        if project:
            alert_queryset = UserOption.objects.filter(
                project=project,
                user__in=user_ids,
                key='mail:email',
            )
            for option in alert_queryset:
                user_ids.remove(option.user_id)
                email_list.add(option.value)

        if user_ids:
            alert_queryset = UserOption.objects.filter(
                user__in=user_ids,
                key='alert_email',
            )
            for option in alert_queryset:
                user_ids.remove(option.user_id)
                email_list.add(option.value)

        if user_ids:
            email_list |= set(User.objects.filter(
                pk__in=user_ids, is_active=True
            ).values_list('email', flat=True))

        return email_list

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
        conf_key = self.get_conf_key()
        cache_key = '%s:send_to:%s' % (conf_key, project_id)

        send_to_list = cache.get(cache_key)
        if send_to_list is None:
            send_to_list = set()

            if project and project.team:
                member_set = self.get_sendable_users(project)
                send_to_list |= set(self.get_emails_for_users(
                    member_set, project=project))

            send_to_list = filter(bool, send_to_list)
            cache.set(cache_key, send_to_list, 60)  # 1 minute cache
        return send_to_list

    def should_notify(self, group, event):
        project = group.project
        send_to = self.get_send_to(project)
        if not send_to:
            return False

        min_level = self.get_option('min_level', project)
        if min_level is not None and int(group.level) < min_level:
            return False

        include_loggers = self.get_option('include_loggers', project)
        if include_loggers is not None and group.logger not in include_loggers:
            return False

        exclude_loggers = self.get_option('exclude_loggers', project)
        if exclude_loggers and group.logger in exclude_loggers:
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
