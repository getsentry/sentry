import logging
from typing import Any, Mapping, MutableMapping, Optional, Set

from sentry.models import User
from sentry.notifications.base import BaseNotification
from sentry.notifications.types import ActionTargetType
from sentry.notifications.utils import (
    get_commits,
    get_interface_list,
    get_link,
    get_rules,
    has_integrations,
)
from sentry.notifications.utils.participants import get_send_to
from sentry.plugins.base.structs import Notification
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class AlertRuleNotification(BaseNotification):
    def __init__(
        self,
        notification: Notification,
        target_type: ActionTargetType,
        target_identifier: Optional[int] = None,
    ) -> None:
        event = notification.event
        group = event.group
        project = group.project
        super().__init__(project, group)
        self.event = event
        self.target_type = target_type
        self.target_identifier = target_identifier
        self.rules = notification.rules

    def get_participants(self) -> Mapping[ExternalProviders, Set[User]]:
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

    def get_subject(self) -> str:
        return str(self.event.get_email_subject())

    def get_reference(self) -> Any:
        return self.group

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
        }

        # if the organization has enabled enhanced privacy controls we dont send
        # data which may show PII or source code
        if not enhanced_privacy:
            context.update({"tags": self.event.tags, "interfaces": get_interface_list(self.event)})

        return context

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
