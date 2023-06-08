import logging
from collections import namedtuple
from typing import Any, Mapping, Optional, Sequence

from sentry import digests
from sentry.digests import Digest
from sentry.digests import get_option_key as get_digest_option_key
from sentry.digests.notifications import event_to_record, unsplit_key
from sentry.models import NotificationSetting, Project, ProjectOption, User
from sentry.notifications.notifications.activity import EMAIL_CLASSES_BY_TYPE
from sentry.notifications.notifications.digest import DigestNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.notifications.user_report import UserReportNotification
from sentry.notifications.types import ActionTargetType, FallthroughChoiceType
from sentry.plugins.base.structs import Notification
from sentry.services.hybrid_cloud.actor import ActorType
from sentry.tasks.digests import deliver_digest
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# TODO(mgaeta): This CANNOT be moved because of the way we inject mail adapters in plugins.
RuleFuture = namedtuple("RuleFuture", ["rule", "kwargs"])


class MailAdapter:
    """
    This class contains generic logic for notifying users via Email.
    TODO(mgaeta): Make an explicit interface that is shared with NotificationPlugin.
    """

    mail_option_key = "mail:subject_prefix"

    def rule_notify(
        self,
        event: Any,
        futures: Sequence[RuleFuture],
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
        fallthrough_choice: FallthroughChoiceType = None,
        skip_digests: bool = False,
    ) -> None:
        metrics.incr("mail_adapter.rule_notify")
        rules = []
        extra = {
            "event_id": event.event_id,
            "group_id": event.group_id,
            "is_from_mail_action_adapter": True,
            "target_type": target_type.value,
            "target_identifier": target_identifier,
            "fallthrough_choice": fallthrough_choice.value if fallthrough_choice else None,
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

        if digests.enabled(project) and not skip_digests:

            def get_digest_option(key):
                return ProjectOption.objects.get_value(project, get_digest_option_key("mail", key))

            digest_key = unsplit_key(
                event.group.project, target_type, target_identifier, fallthrough_choice
            )
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
            self.notify(notification, target_type, target_identifier, fallthrough_choice)

        logger.info("mail.adapter.notification.%s" % log_event, extra=extra)

    @staticmethod
    def get_sendable_user_objects(project):
        """
        Return a collection of USERS that are eligible to receive
        notifications for the provided project.
        """
        user_ids = project.member_set.values_list("user", flat=True)
        users = User.objects.filter(id__in=user_ids)

        accepting_recipients = NotificationSetting.objects.filter_to_accepting_recipients(
            project, users
        )
        email_recipients = accepting_recipients.get(ExternalProviders.EMAIL, ())

        users_by_id = {user.id: user for user in users}
        return [
            users_by_id[recipient.id]
            for recipient in email_recipients
            if recipient.actor_type == ActorType.USER
        ]

    def get_sendable_user_ids(self, project):
        users = self.get_sendable_user_objects(project)
        return [user.id for user in users]

    def get_sendable_users(self, project):
        """@deprecated Do not change this function, it is being used in getsentry."""
        users = self.get_sendable_user_objects(project)
        return [user.id for user in users]

    @staticmethod
    def notify(
        notification, target_type, target_identifier=None, fallthrough_choice=None, **kwargs
    ):
        AlertRuleNotification(
            notification, target_type, target_identifier, fallthrough_choice
        ).send()

    @staticmethod
    def notify_digest(
        project: Project,
        digest: Digest,
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
        fallthrough_choice: Optional[FallthroughChoiceType] = None,
    ) -> None:
        metrics.incr("mail_adapter.notify_digest")
        return DigestNotification(
            project, digest, target_type, target_identifier, fallthrough_choice
        ).send()

    @staticmethod
    def notify_about_activity(activity):
        metrics.incr("mail_adapter.notify_about_activity")
        email_cls = EMAIL_CLASSES_BY_TYPE.get(activity.type)
        if not email_cls:
            logger.debug(f"No email associated with activity type `{activity.get_type_display()}`")
            return

        email_cls(activity).send()

    @staticmethod
    def handle_user_report(report: Mapping[str, Any], project: Project):
        metrics.incr("mail_adapter.handle_user_report")
        return UserReportNotification(project, report).send()
