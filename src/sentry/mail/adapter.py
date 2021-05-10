import itertools
import logging
from typing import Any, Optional, Sequence

from django.utils import dateformat
from django.utils.encoding import force_text

from sentry import digests, options
from sentry.digests import get_option_key as get_digest_option_key
from sentry.digests.notifications import event_to_record, unsplit_key
from sentry.digests.utilities import get_digest_metadata, get_personalized_digests
from sentry.models import Group, GroupSubscription, NotificationSetting, Project, ProjectOption
from sentry.notifications.activity import EMAIL_CLASSES_BY_TYPE
from sentry.notifications.rules import AlertRuleNotification, get_send_to
from sentry.notifications.types import ActionTargetType, GroupSubscriptionReason
from sentry.plugins.base.structs import Notification
from sentry.tasks.digests import deliver_digest
from sentry.types.integrations import ExternalProviders
from sentry.utils import json, metrics
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.linksign import generate_signed_link

logger = logging.getLogger(__name__)


class MailAdapter:
    """ This class contains generic logic for notifying users via Email. """

    mail_option_key = "mail:subject_prefix"

    def rule_notify(
        self,
        event: Any,
        futures: Sequence[Any],
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
    ) -> None:
        metrics.incr("mail_adapter.rule_notify")
        rules = []
        extra = {
            "event_id": event.event_id,
            "group_id": event.group_id,
            "is_from_mail_action_adapter": True,
            "target_type": target_type.value,
            "target_identifier": target_identifier,
        }
        log_event = "dispatched"
        for future in futures:
            rules.append(future.rule)
            extra["rule_id"] = future.rule.id
            if not future.kwargs:
                continue
            raise NotImplementedError(
                "The default behavior for notification de-duplication does not support args"
            )

        project = event.group.project
        extra["project_id"] = project.id

        if digests.enabled(project):

            def get_digest_option(key):
                return ProjectOption.objects.get_value(project, get_digest_option_key("mail", key))

            digest_key = unsplit_key(event.group.project, target_type, target_identifier)
            extra["digest_key"] = digest_key
            immediate_delivery = digests.add(
                digest_key,
                event_to_record(event, rules),
                increment_delay=get_digest_option("increment_delay"),
                maximum_delay=get_digest_option("maximum_delay"),
            )
            if immediate_delivery:
                deliver_digest.delay(digest_key)
            else:
                log_event = "digested"

        else:
            notification = Notification(event=event, rules=rules)
            self.notify(notification, target_type, target_identifier)

        logger.info("mail.adapter.notification.%s" % log_event, extra=extra)

    def _build_subject_prefix(self, project):
        subject_prefix = ProjectOption.objects.get_value(project, self.mail_option_key, None)
        if not subject_prefix:
            subject_prefix = options.get("mail.subject-prefix")
        return force_text(subject_prefix)

    def _build_message(
        self,
        project,
        subject,
        template=None,
        html_template=None,
        body=None,
        reference=None,
        reply_reference=None,
        headers=None,
        context=None,
        send_to=None,
        type=None,
    ):
        if not send_to:
            logger.debug("Skipping message rendering, no users to send to.")
            return

        subject_prefix = self._build_subject_prefix(project)
        subject = force_text(subject)

        msg = MessageBuilder(
            subject=f"{subject_prefix}{subject}",
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

    @staticmethod
    def get_sendable_user_objects(project):
        """
        Return a collection of USERS that are eligible to receive
        notifications for the provided project.
        """
        return NotificationSetting.objects.get_notification_recipients(project)[
            ExternalProviders.EMAIL
        ]

    def get_sendable_user_ids(self, project):
        users = self.get_sendable_user_objects(project)
        return [user.id for user in users]

    def get_sendable_users(self, project):
        """ @deprecated Do not change this function, it is being used in getsentry. """
        users = self.get_sendable_user_objects(project)
        return [user.id for user in users]

    def should_notify(self, target_type, group):
        metrics.incr("mail_adapter.should_notify")
        # only notify if we have users to notify. We always want to notify if targeting
        # a member directly.
        return target_type == ActionTargetType.MEMBER or self.get_sendable_user_objects(
            group.project
        )

    def add_unsubscribe_link(self, context, user_id, project, referrer):
        context["unsubscribe_link"] = generate_signed_link(
            user_id,
            "sentry-account-email-unsubscribe-project",
            referrer,
            kwargs={"project_id": project.id},
        )

    def notify(self, notification, target_type, target_identifier=None, **kwargs):
        AlertRuleNotification(notification, target_type, target_identifier).send()

    def get_digest_subject(self, group, counts, date):
        return "{short_id} - {count} new {noun} since {date}".format(
            short_id=group.qualified_short_id,
            count=len(counts),
            noun="alert" if len(counts) == 1 else "alerts",
            date=dateformat.format(date, "N j, Y, P e"),
        )

    def notify_digest(
        self,
        project: Project,
        digest: Any,
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
    ) -> None:
        metrics.incr("mail_adapter.notify_digest")

        users = get_send_to(project, target_type, target_identifier).get(ExternalProviders.EMAIL)
        if not users:
            return
        user_ids = {user.id for user in users}

        logger.info(
            "mail.adapter.notify_digest",
            extra={
                "project_id": project.id,
                "target_type": target_type.value,
                "target_identifier": target_identifier,
                "user_ids": user_ids,
            },
        )
        for user_id, digest in get_personalized_digests(target_type, project.id, digest, user_ids):
            start, end, counts = get_digest_metadata(digest)

            # If there is only one group in this digest (regardless of how many
            # rules it appears in), we should just render this using the single
            # notification template. If there is more than one record for a group,
            # just choose the most recent one.
            if len(counts) == 1:
                group = next(iter(counts))
                record = max(
                    itertools.chain.from_iterable(
                        groups.get(group, []) for groups in digest.values()
                    ),
                    key=lambda record: record.timestamp,
                )
                notification = Notification(record.value.event, rules=record.value.rules)
                return self.notify(notification, target_type, target_identifier)

            context = {
                "start": start,
                "end": end,
                "project": project,
                "digest": digest,
                "counts": counts,
            }

            headers = {
                "X-Sentry-Project": project.slug,
                "X-SMTPAPI": json.dumps({"category": "digest_email"}),
            }

            group = next(iter(counts))
            subject = self.get_digest_subject(group, counts, start)

            self.add_unsubscribe_link(context, user_id, project, "alert_digest")
            self._send_mail(
                subject=subject,
                template="sentry/emails/digests/body.txt",
                html_template="sentry/emails/digests/body.html",
                project=project,
                reference=project,
                headers=headers,
                type="notify.digest",
                context=context,
                send_to=[user_id],
            )

    def notify_about_activity(self, activity):
        metrics.incr("mail_adapter.notify_about_activity")
        email_cls = EMAIL_CLASSES_BY_TYPE.get(activity.type)
        if not email_cls:
            logger.debug(f"No email associated with activity type `{activity.get_type_display()}`")
            return

        email = email_cls(activity)
        email.send()

    def handle_user_report(self, payload, project, **kwargs):
        metrics.incr("mail_adapter.handle_user_report")
        group = Group.objects.get(id=payload["report"]["issue"]["id"])

        participants = GroupSubscription.objects.get_participants(group=group).get(
            ExternalProviders.EMAIL
        )

        if not participants:
            return

        org = group.organization
        enhanced_privacy = org.flags.enhanced_privacy

        context = {
            "project": project,
            "project_link": absolute_uri(f"/{project.organization.slug}/{project.slug}/"),
            "issue_link": absolute_uri(
                "/{}/{}/issues/{}/".format(
                    project.organization.slug, project.slug, payload["report"]["issue"]["id"]
                )
            ),
            # TODO(dcramer): we dont have permalinks to feedback yet
            "link": absolute_uri(
                "/{}/{}/issues/{}/feedback/".format(
                    project.organization.slug, project.slug, payload["report"]["issue"]["id"]
                )
            ),
            "group": group,
            "report": payload["report"],
            "enhanced_privacy": enhanced_privacy,
        }

        subject_prefix = self._build_subject_prefix(project)
        subject = force_text(
            "{}{} - New Feedback from {}".format(
                subject_prefix, group.qualified_short_id, payload["report"]["name"]
            )
        )

        headers = {
            "X-Sentry-Project": project.slug,
            "X-SMTPAPI": json.dumps({"category": "user_report_email"}),
        }

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
        metrics.incr("mail_adapter.handle_signal")
        if name == "user-reports.created":
            self.handle_user_report(payload, **kwargs)
