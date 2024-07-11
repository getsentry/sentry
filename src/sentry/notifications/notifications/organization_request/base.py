from __future__ import annotations

import abc
import logging
from collections.abc import Mapping, MutableMapping
from typing import TYPE_CHECKING, Any

from sentry.db.models import Model
from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingEnum
from sentry.types.actor import Actor

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    notification_setting_type_enum = NotificationSettingEnum.APPROVAL
    RoleBasedRecipientStrategyClass: type[RoleBasedRecipientStrategy]

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester
        self.role_based_recipient_strategy = self.RoleBasedRecipientStrategyClass(organization)

    @property
    def reference(self) -> Model | None:
        return self.organization

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def determine_recipients(self) -> list[Actor]:
        return Actor.many_from_object(self.role_based_recipient_strategy.determine_recipients())

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        # purposely use empty string for the notification title
        return ""

    def build_notification_footer(self, recipient: Actor, provider: ExternalProviders) -> str:
        if recipient.is_team:
            raise NotImplementedError

        settings_url = self.format_url(
            text="Notification Settings",
            url=self.get_settings_url(recipient, provider),
            provider=provider,
        )

        return self.role_based_recipient_strategy.build_notification_footer_from_settings_url(
            settings_url
        )

    def get_title_link(self, recipient: Actor, provider: ExternalProviders) -> str | None:
        return None

    def get_log_params(self, recipient: Actor) -> MutableMapping[str, Any]:
        if recipient.is_team:
            raise NotImplementedError

        return {
            **super().get_log_params(recipient),
            "user_id": self.requester.id,
            "target_user_id": recipient.id,
        }
