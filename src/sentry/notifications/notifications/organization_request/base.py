from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any, Iterable, MutableMapping, Type

from sentry.models import Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    notification_setting_type = NotificationSettingTypes.APPROVAL
    referrer_base: str = ""
    RoleBasedRecipientStrategyClass: Type[RoleBasedRecipientStrategy]

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester
        self.role_based_recipient_strategy = self.RoleBasedRecipientStrategyClass(organization)

    def get_reference(self) -> Any:
        return self.organization

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def determine_recipients(self) -> Iterable[Team | User]:
        return self.role_based_recipient_strategy.determine_recipients()

    def get_notification_title(self) -> str:
        # purposely use empty string for the notification title
        return ""

    def build_notification_footer(self, recipient: Team | User) -> str:
        if isinstance(recipient, Team):
            raise NotImplementedError

        # notification footer only used for Slack for now
        settings_url = self.get_settings_url(recipient, ExternalProviders.SLACK)
        return self.role_based_recipient_strategy.build_notification_footer_from_settings_url(
            settings_url, recipient
        )

    def get_title_link(self, recipient: Team | User) -> str | None:
        return None

    def get_log_params(self, recipient: Team | User) -> MutableMapping[str, Any]:
        if isinstance(recipient, Team):
            raise NotImplementedError

        return {
            **super().get_log_params(recipient),
            "user_id": self.requester.id,
            "target_user_id": recipient.id,
        }
