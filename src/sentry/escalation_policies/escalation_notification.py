import zoneinfo
from collections.abc import Iterable, Mapping, MutableMapping
from datetime import UTC, tzinfo
from typing import Any

from sentry.db.models.base import Model
from sentry.escalation_policies.logic import determine_schedule_oncall
from sentry.escalation_policies.models.escalation_policy import EscalationPolicyStepRecipient
from sentry.integrations.types import ExternalProviders
from sentry.models.group import Group
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import ActionTargetType, NotificationSettingEnum
from sentry.notifications.utils.participants import get_send_to
from sentry.types.actor import Actor
from sentry.users.services.user_option import get_option_from_list, user_option_service


class EscalationNotification(ProjectNotification):
    metrics_key = "escalation"
    # This would be different
    notification_setting_type_enum = NotificationSettingEnum.ESCALATION_POLICY
    template_path = "sentry/emails/escalation"

    def __init__(
        self,
        group: Group,
        recipients: list[EscalationPolicyStepRecipient],
    ) -> None:
        project = group.project
        super().__init__(project)
        self.group = group
        self.recipients = recipients

    def get_title_link(self, recipient: Actor, provider: ExternalProviders) -> str | None:
        return ""

    def build_attachment_title(self, recipient: Any) -> str:
        return "Escalation Notification"

    def get_recipient_context(
        self, recipient: Actor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        tz: tzinfo = UTC
        if recipient.is_user:
            user_options = user_option_service.get_many(
                filter={"user_ids": [recipient.id], "keys": ["timezone"]}
            )
            user_tz = get_option_from_list(user_options, key="timezone", default="UTC")
            try:
                tz = zoneinfo.ZoneInfo(user_tz)
            except (ValueError, zoneinfo.ZoneInfoNotFoundError):
                pass
        return {
            **super().get_recipient_context(recipient, extra_context),
            "timezone": tz,
        }

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "group": self.group,
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return "You have an escalating issue to attend to"

    def reference(self) -> Model | None:
        return self.group

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Actor]]:
        result = {}

        for recipient in self.recipients:
            if recipient.team:
                target_type = ActionTargetType.TEAM
                target_identifier = recipient.team.id
            elif recipient.user_id:
                target_type = ActionTargetType.MEMBER
                target_identifier = recipient.user_id
            elif recipient.schedule:
                target_type = ActionTargetType.MEMBER
                target_identifier = determine_schedule_oncall(recipient.schedule)
            else:
                continue

            for provider, actors in get_send_to(
                project=self.project,
                target_type=target_type,
                target_identifier=target_identifier,
                notification_type_enum=self.notification_setting_type_enum,
                notification_uuid=self.notification_uuid,
            ).items():
                result.setdefault(provider, []).extend(actors)

        return result

    def send(self) -> None:
        from sentry.notifications.notify import notify

        participants_by_provider = self.get_participants()
        shared_context = self.get_context()
        for provider, participants in participants_by_provider.items():
            notify(provider, self, participants, shared_context)


from sentry import analytics


# TODO: should have same base class as SlackIntegrationNotificationSent
class SMSNotificationSent(analytics.Event):
    type = "integrations.sms.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id", required=False),
        analytics.Attribute("category"),
        analytics.Attribute("actor_id", required=False),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("group_id", required=False),
        analytics.Attribute("id"),
        analytics.Attribute("notification_uuid"),
        analytics.Attribute("alert_id", required=False),
    )


analytics.register(SMSNotificationSent)
