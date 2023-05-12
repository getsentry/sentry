from __future__ import annotations

import logging
from typing import Any, Iterable, Mapping, MutableMapping
from urllib.parse import urlencode

import pytz

from sentry import features
from sentry.db.models import Model
from sentry.issues.grouptype import GROUP_CATEGORIES_CUSTOM_EMAIL, GroupCategory
from sentry.models import UserOption
from sentry.models.groupinbox import GroupInbox, get_inbox_reason_text
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.types import (
    ActionTargetType,
    FallthroughChoiceType,
    NotificationSettingTypes,
)
from sentry.notifications.utils import (
    get_commits,
    get_generic_data,
    get_group_settings_link,
    get_integration_link,
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_rules,
    get_transaction_data,
    has_alert_integration,
    has_integrations,
)
from sentry.notifications.utils.participants import get_owner_reason, get_send_to
from sentry.plugins.base.structs import Notification
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics
from sentry.utils.http import absolute_uri

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
        fallthrough_choice: FallthroughChoiceType | None = None,
    ) -> None:
        event = notification.event
        group = event.group
        project = group.project
        super().__init__(project)
        self.group = group
        self.event = event
        self.target_type = target_type
        self.target_identifier = target_identifier
        self.fallthrough_choice = fallthrough_choice
        self.rules = notification.rules
        self.template_path = (
            f"sentry/emails/{event.group.issue_category.name.lower()}"
            if event.group.issue_category in GROUP_CATEGORIES_CUSTOM_EMAIL
            else "sentry/emails/generic"
        )

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        return get_send_to(
            project=self.project,
            target_type=self.target_type,
            target_identifier=self.target_identifier,
            event=self.event,
            notification_type=self.notification_setting_type,
            fallthrough_choice=self.fallthrough_choice,
            rules=self.rules,
        )

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return str(self.event.get_email_subject())

    @property
    def reference(self) -> Model | None:
        return self.group

    def get_recipient_context(
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        timezone = pytz.timezone("UTC")

        if recipient.actor_type == ActorType.USER:
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
        sentry_query_params = self.get_sentry_query_params(ExternalProviders.EMAIL)
        for rule in rule_details:
            rule.url = rule.url + sentry_query_params
            rule.status_url = rule.url + sentry_query_params

        notification_reason = get_owner_reason(
            project=self.project,
            target_type=self.target_type,
            event=self.event,
            fallthrough_choice=self.fallthrough_choice,
        )
        fallback_params: MutableMapping[str, str] = {}
        group_inbox_reason = GroupInbox.objects.filter(
            group=self.group, project=self.project
        ).first()
        group_header = get_inbox_reason_text(group_inbox_reason)

        context = {
            "project_label": self.project.get_full_name(),
            "group": self.group,
            "group_header": group_header,
            "event": self.event,
            "link": get_group_settings_link(
                self.group, environment, rule_details, None, **fallback_params
            ),
            "rules": rule_details,
            "has_integrations": has_integrations(self.organization, self.project),
            "enhanced_privacy": enhanced_privacy,
            "commits": get_commits(self.project, self.event),
            "environment": environment,
            "slack_link": get_integration_link(self.organization, "slack"),
            "notification_reason": notification_reason,
            "notification_settings_link": absolute_uri(
                f"/settings/account/notifications/alerts/{sentry_query_params}"
            ),
            "has_alert_integration": has_alert_integration(self.project),
            "issue_type": self.group.issue_type.description,
            "subtitle": self.event.title,
            "has_issue_states": features.has("organizations:issue-states", self.organization),
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

        if features.has("organizations:mute-alerts", self.organization) and len(self.rules) > 0:
            context["snooze_alert"] = True
            context[
                "snooze_alert_url"
            ] = f"/organizations/{self.organization.slug}/alerts/rules/{self.project.slug}/{self.rules[0].id}/details/{sentry_query_params}&{urlencode({'mute': '1'})}"

        if getattr(self.event, "occurrence", None):
            context["issue_title"] = self.event.occurrence.issue_title
            context["subtitle"] = self.event.occurrence.subtitle
            context["culprit"] = self.event.occurrence.culprit

        if self.group.issue_category not in GROUP_CATEGORIES_CUSTOM_EMAIL:
            generic_issue_data_html = get_generic_data(self.event)
            if generic_issue_data_html:
                context.update(
                    {
                        "generic_issue_data": [("Issue Data", generic_issue_data_html, None)],
                    }
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
                "organization": self.organization.id,
                "fallthrough_choice": self.fallthrough_choice.value
                if self.fallthrough_choice
                else None,
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

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        return {
            "target_type": self.target_type,
            "target_identifier": self.target_identifier,
            **super().get_log_params(recipient),
        }
