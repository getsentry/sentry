from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Type

from sentry.db.models import Model
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    notification_setting_type = NotificationSettingTypes.APPROVAL
    RoleBasedRecipientStrategyClass: Type[RoleBasedRecipientStrategy]

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester
        self.role_based_recipient_strategy = self.RoleBasedRecipientStrategyClass(organization)

    @property
    def reference(self) -> Model | None:
        return self.organization

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def determine_recipients(self) -> Iterable[RpcActor]:
        return RpcActor.many_from_object(self.role_based_recipient_strategy.determine_recipients())

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        # purposely use empty string for the notification title
        return ""

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        if recipient.actor_type == ActorType.TEAM:
            raise NotImplementedError

        settings_url = self.format_url(
            text="Notification Settings",
            url=self.get_settings_url(recipient, provider),
            provider=provider,
        )

        return self.role_based_recipient_strategy.build_notification_footer_from_settings_url(
            settings_url
        )

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def get_log_params(self, recipient: RpcActor) -> MutableMapping[str, Any]:
        if recipient.actor_type == ActorType.TEAM:
            raise NotImplementedError

        return {
            **super().get_log_params(recipient),
            "user_id": self.requester.id,
            "target_user_id": recipient.id,
        }
