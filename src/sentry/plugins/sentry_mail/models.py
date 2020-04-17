from __future__ import absolute_import

import logging

import sentry

from sentry.mail.adapter import MailAdapter, ActionTargetType
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


class MailPlugin(NotificationPlugin):
    title = "Mail"
    conf_key = "mail"
    slug = "mail"
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True
    project_conf_form = None
    mail_adapter = MailAdapter()

    def rule_notify(self, event, futures):
        return self.mail_adapter.rule_notify(
            event, futures, target_type=ActionTargetType.ISSUE_OWNERS
        )

    def get_project_url(self, project):
        return absolute_uri(u"/{}/{}/".format(project.organization.slug, project.slug))

    def is_configured(self, project, **kwargs):
        # Nothing to configure here
        return True

    def should_notify(self, group, event):
        return (
            not group.project.flags.has_issue_alerts_targeting
            and self.mail_adapter.should_notify(group)
        )

    def notify(self, notification, **kwargs):
        return self.mail_adapter.notify(
            notification, target_type=ActionTargetType.ISSUE_OWNERS, **kwargs
        )

    def notify_digest(self, project, digest):
        return self.mail_adapter.notify_digest(
            project, digest, target_type=ActionTargetType.ISSUE_OWNERS
        )

    def notify_about_activity(self, activity):
        if activity.project.flags.has_issue_alerts_targeting:
            return

        return self.mail_adapter.notify_about_activity(activity)

    def handle_signal(self, name, payload, **kwargs):
        if name == "user-reports.created":
            project = kwargs.get("project")
            if project and not project.flags.has_issue_alerts_targeting:
                self.mail_adapter.handle_signal(name, payload, **kwargs)

    def can_configure_for_project(self, project):
        return (
            super(MailPlugin, self).can_configure_for_project(project)
            and not project.flags.has_issue_alerts_targeting
        )


# Legacy compatibility
MailProcessor = MailPlugin
