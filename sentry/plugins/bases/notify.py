"""
sentry.plugins.bases.notify
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django import forms
from django.utils.translation import ugettext_lazy as _
from sentry.conf import settings
from sentry.plugins import Plugin


class NotifyConfigurationForm(forms.Form):
    send_to_members = forms.BooleanField(label=_('Include project members'), initial=False, required=False,
        help_text=_('Notify members of this project.'))
    send_to_admins = forms.BooleanField(label=_('Include sentry admins'), initial=False, required=False,
        help_text=_('Notify administrators of this Sentry server.'))


class NotifyPlugin(Plugin):
    description = _("Notify project members when a new event is seen for the first time, or when an "
                   "already resolved event has changed back to unresolved.")
    # site_conf_form = NotifyConfigurationForm
    project_conf_form = NotifyConfigurationForm

    def __init__(self, *args, **kwargs):
        super(NotifyPlugin, self).__init__(*args, **kwargs)

    def notify_users(self, group, event, fail_silently=False):
        raise NotImplementedError

    def get_send_to(self, project=None):
        send_to_list = set()

        send_to_admins = self.get_option('send_to_admins', project)

        if send_to_admins:
            send_to_list |= set(settings.ADMINS)

        send_to_members = self.get_option('send_to_members', project)
        if send_to_members and project and project.team:
            send_to_list |= set(project.team.member_set.values_list('user__email', flat=True))

        return filter(bool, send_to_list)

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

        return True

    ## plugin hooks

    def get_form_initial(self, project=None):
        return {'send_to_members': True}

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        if not is_new:
            return

        if not self.should_notify(group, event):
            return

        self.notify_users(group, event)
