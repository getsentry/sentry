from __future__ import annotations

import logging
from typing import Any, Iterable, Mapping, MutableMapping

import pytz

from sentry.db.models import Model
from sentry.models import Team, User, UserOption
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import ActionTargetType, NotificationSettingTypes
from sentry.notifications.utils import (
    get_commits,
    get_default_data,
    get_group_settings_link,
    get_integration_link,
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_rules,
    get_transaction_data,
    has_alert_integration,
    has_integrations,
)
from sentry.notifications.utils.participants import get_send_to
from sentry.plugins.base.structs import Notification
from sentry.types.integrations import ExternalProviders
from sentry.types.issues import GROUP_TYPE_TO_TEXT, GroupCategory
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class AlertRuleNotification(ProjectNotification):
    message_builder = "IssueNotificationMessageBuilder"
    metrics_key = "issue_alert"
    notification_setting_type = NotificationSettingTypes.ISSUE_ALERTS
    template_path = "sentry/emails/error"

    def __init__(
        self,
        notification: Notification,
        target_type: ActionTargetType,
        target_identifier: int | None = None,
    ) -> None:
        event = notification.event
        group = event.group
        project = group.project
        super().__init__(project)
        self.group = group
        self.event = event
        self.target_type = target_type
        self.target_identifier = target_identifier
        self.rules = notification.rules
        self.template_path = f"sentry/emails/{event.group.issue_category.name.lower()}"

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        return get_send_to(
            project=self.project,
            target_type=self.target_type,
            target_identifier=self.target_identifier,
            event=self.event,
            notification_type=self.notification_setting_type,
        )

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return str(self.event.get_email_subject())

    @property
    def reference(self) -> Model | None:
        return self.group

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        timezone = pytz.timezone("UTC")

        if recipient.class_name() == "User":
            user_tz = UserOption.objects.get_value(user=recipient, key="timezone", default="UTC")
            try:
                timezone = pytz.timezone(user_tz)
            except pytz.UnknownTimeZoneError:
                pass
        return {
            **super().get_recipient_context(recipient, extra_context),
            "timezone": timezone,
        }

    def get_context(self) -> MutableMapping[str, Any]:
        environment = self.event.get_tag("environment")
        enhanced_privacy = self.organization.flags.enhanced_privacy
        rule_details = get_rules(self.rules, self.organization, self.project)
        context = {
            "project_label": self.project.get_full_name(),
            "group": self.group,
            "event": self.event,
            "link": get_group_settings_link(self.group, environment, rule_details),
            "rules": rule_details,
            "has_integrations": has_integrations(self.organization, self.project),
            "enhanced_privacy": enhanced_privacy,
            "commits": get_commits(self.project, self.event),
            "environment": environment,
            "slack_link": get_integration_link(self.organization, "slack"),
            "has_alert_integration": has_alert_integration(self.project),
            "issue_type": GROUP_TYPE_TO_TEXT.get(self.group.issue_type, "Issue"),
            "subtitle": self.event.title,
            "default_issue_data": [("Issue Data", get_default_data(self.event)), None],
        }

        # if the organization has enabled enhanced privacy controls we don't send
        # data which may show PII or source code
        if not enhanced_privacy:
            context.update({"tags": self.event.tags, "interfaces": get_interface_list(self.event)})

        if self.group.issue_category == GroupCategory.PERFORMANCE:
            context.update(
                {
                    "transaction_data": [("Span Evidence", get_transaction_data(self.event), None)],
                    "subtitle": get_performance_issue_alert_subtitle(self.event),
                },
            )
        return context

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        from sentry.integrations.message_builder import build_rule_url

        title_str = "Alert triggered"

        if self.rules:
            rule_url = build_rule_url(self.rules[0], self.group, self.project)
            title_str += (
                f" {self.format_url(text=self.rules[0].label, url=rule_url, provider=provider)}"
            )

            if len(self.rules) > 1:
                title_str += f" (+{len(self.rules) - 1} other)"

        return title_str

    def send(self) -> None:
        from sentry.notifications.notify import notify

        metrics.incr("mail_adapter.notify")
        logger.info(
            "mail.adapter.notify",
            extra={
                "target_type": self.target_type.value,
                "target_identifier": self.target_identifier,
                "group": self.group.id,
                "project_id": self.project.id,
            },
        )

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            logger.info(
                "notifications.notification.rules.alertrulenotification.skip.no_participants",
                extra={
                    "target_type": self.target_type.value,
                    "target_identifier": self.target_identifier,
                    "group": self.group.id,
                    "project_id": self.project.id,
                },
            )
            return

        # Only calculate shared context once.
        shared_context = self.get_context()

        for provider, participants in participants_by_provider.items():
            notify(provider, self, participants, shared_context)

    def get_log_params(self, recipient: Team | User) -> Mapping[str, Any]:
        return {
            "target_type": self.target_type,
            "target_identifier": self.target_identifier,
            **super().get_log_params(recipient),
        }
