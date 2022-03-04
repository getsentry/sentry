from __future__ import annotations

import logging
from typing import Any, Iterable, Mapping, MutableMapping

import pytz

from sentry import features
from sentry.models import Team, User, UserOption
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import ActionTargetType, NotificationSettingTypes
from sentry.notifications.utils import (
    get_commits,
    get_integration_link,
    get_interface_list,
    get_link,
    get_rules,
    has_alert_integration,
    has_integrations,
)
from sentry.notifications.utils.participants import get_send_to
from sentry.plugins.base.structs import Notification
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class AlertRuleNotification(ProjectNotification):
    message_builder = "IssueNotificationMessageBuilder"
    notification_setting_type = NotificationSettingTypes.ISSUE_ALERTS
    metrics_key = "issue_alert"
    referrer_base = "alert-rule"

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

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        return get_send_to(
            project=self.project,
            target_type=self.target_type,
            target_identifier=self.target_identifier,
            event=self.event,
        )

    def get_filename(self) -> str:
        return "error"

    def get_category(self) -> str:
        return "issue_alert_email"

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return str(self.event.get_email_subject())

    def get_reference(self) -> Any:
        return self.group

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        timezone = pytz.timezone("UTC")

        if isinstance(recipient, User):
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
        alert_status_page_enabled = features.has(
            "organizations:alert-rule-status-page", self.project.organization
        )
        context = {
            "project_label": self.project.get_full_name(),
            "group": self.group,
            "event": self.event,
            "link": get_link(self.group, environment),
            "rules": get_rules(self.rules, self.organization, self.project),
            "has_integrations": has_integrations(self.organization, self.project),
            "enhanced_privacy": enhanced_privacy,
            "commits": get_commits(self.project, self.event),
            "environment": environment,
            "slack_link": get_integration_link(self.organization, "slack"),
            "has_alert_integration": has_alert_integration(self.project),
            "alert_status_page_enabled": alert_status_page_enabled,
        }

        # if the organization has enabled enhanced privacy controls we don't send
        # data which may show PII or source code
        if not enhanced_privacy:
            context.update({"tags": self.event.tags, "interfaces": get_interface_list(self.event)})

        return context

    def get_notification_title(self) -> Any:
        from sentry.integrations.slack.message_builder.issues import build_rule_url

        title_str = "Alert triggered"

        if self.rules:
            rule_url = build_rule_url(self.rules[0], self.group, self.project)
            title_str += f" <{rule_url}|{self.rules[0].label}>"

            if len(self.rules) > 1:
                title_str += f" (+{len(self.rules) - 1} other)"

        return title_str

    def get_type(self) -> str:
        return "notify.error"

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
