from __future__ import absolute_import

import logging

import sentry

from django.utils.encoding import force_text

from sentry.mail.adapter import MailAdapter
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

from .activity import emails

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
        return self.mail_adapter.rule_notify(event, futures)

    def get_project_url(self, project):
        return absolute_uri(u"/{}/{}/".format(project.organization.slug, project.slug))

    def is_configured(self, project, **kwargs):
        # Nothing to configure here
        return True

    def should_notify(self, group, event):
        return self.mail_adapter.should_notify(group)

    def notify(self, notification, **kwargs):
        return self.mail_adapter.notify(notification, **kwargs)

    def notify_digest(self, project, digest):
        return self.mail_adapter.notify_digest(project, digest)

    def notify_about_activity(self, activity):
        email_cls = emails.get(activity.type)
        if not email_cls:
            logger.debug(
                u"No email associated with activity type `{}`".format(activity.get_type_display())
            )
            return

        email = email_cls(activity)
        email.send()

    def handle_user_report(self, payload, project, **kwargs):
        from sentry.models import Group, GroupSubscription, GroupSubscriptionReason

        group = Group.objects.get(id=payload["report"]["issue"]["id"])

        participants = GroupSubscription.objects.get_participants(group=group)

        if not participants:
            return

        org = group.organization
        enhanced_privacy = org.flags.enhanced_privacy

        context = {
            "project": project,
            "project_link": absolute_uri(
                u"/{}/{}/".format(project.organization.slug, project.slug)
            ),
            "issue_link": absolute_uri(
                u"/{}/{}/issues/{}/".format(
                    project.organization.slug, project.slug, payload["report"]["issue"]["id"]
                )
            ),
            # TODO(dcramer): we dont have permalinks to feedback yet
            "link": absolute_uri(
                u"/{}/{}/issues/{}/feedback/".format(
                    project.organization.slug, project.slug, payload["report"]["issue"]["id"]
                )
            ),
            "group": group,
            "report": payload["report"],
            "enhanced_privacy": enhanced_privacy,
        }

        subject_prefix = self.mail_adapter._build_subject_prefix(project)
        subject = force_text(
            u"{}{} - New Feedback from {}".format(
                subject_prefix, group.qualified_short_id, payload["report"]["name"]
            )
        )

        headers = {"X-Sentry-Project": project.slug}

        # TODO(dcramer): this is copypasta'd from activity notifications
        # and while it'd be nice to re-use all of that, they are currently
        # coupled to <Activity> instances which makes this tough
        for user, reason in participants.items():
            context.update(
                {
                    "reason": GroupSubscriptionReason.descriptions.get(
                        reason, "are subscribed to this issue"
                    ),
                    "unsubscribe_link": generate_signed_link(
                        user.id,
                        "sentry-account-email-unsubscribe-issue",
                        kwargs={"issue_id": group.id},
                    ),
                }
            )

            msg = MessageBuilder(
                subject=subject,
                template="sentry/emails/activity/new-user-feedback.txt",
                html_template="sentry/emails/activity/new-user-feedback.html",
                headers=headers,
                type="notify.user-report",
                context=context,
                reference=group,
            )
            msg.add_users([user.id], project=project)
            msg.send_async()

    def handle_signal(self, name, payload, **kwargs):
        if name == "user-reports.created":
            self.handle_user_report(payload, **kwargs)

    def can_configure_for_project(self, project):
        return (
            super(MailPlugin, self).can_configure_for_project(project)
            and not project.flags.has_issue_alerts_targeting
        )


# Legacy compatibility
MailProcessor = MailPlugin
