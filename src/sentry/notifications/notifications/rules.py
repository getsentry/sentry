import logging
from typing import Any, Iterable, Mapping, MutableMapping, Optional, Union

import pytz

from sentry.models import Team, User, UserOption
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.types import ActionTargetType
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


class AlertRuleNotification(BaseNotification):
    fine_tuning_key = "alerts"
    is_message_issue_unfurl = True

    def __init__(
        self,
        notification: Notification,
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
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

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
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

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        return str(self.event.get_email_subject())

    def get_reference(self) -> Any:
        return self.group

    def get_recipient_context(
        self, recipient: Union["Team", "User"], extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        parent_context = super().get_recipient_context(recipient, extra_context)
        user_context = {"timezone": pytz.timezone("UTC"), **parent_context}
        try:
            # AlertRuleNotification is shared among both email and slack notifications, and in slack
            # notifications, the `user` arg could be of type `Team` which is why we need this check
            if isinstance(recipient, User):
                user_context.update(
                    {
                        "timezone": pytz.timezone(
                            UserOption.objects.get_value(
                                user=recipient, key="timezone", default="UTC"
                            )
                        )
                    }
                )
        except pytz.UnknownTimeZoneError:
            pass
        return user_context

    def get_context(self) -> MutableMapping[str, Any]:
        environment = self.event.get_tag("environment")
        enhanced_privacy = self.organization.flags.enhanced_privacy
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
            return

        # Only calculate shared context once.
        shared_context = self.get_context()

        for provider, participants in participants_by_provider.items():
            notify(provider, self, participants, shared_context)
