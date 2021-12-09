from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any, MutableMapping

from sentry.models import Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.mixins.role_based_mixin import RoleBasedMixin
from sentry.notifications.types import NotificationSettingTypes

if TYPE_CHECKING:
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(RoleBasedMixin, BaseNotification, abc.ABC):
    analytics_event: str = ""
    notification_setting_type = NotificationSettingTypes.APPROVAL

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester

    def get_reference(self) -> Any:
        return self.organization

    def get_notification_title(self) -> str:
        # purposely use empty string for the notification title
        return ""

    def get_title_link(self) -> str | None:
        return None

    def get_log_params(self, recipient: Team | User) -> MutableMapping[str, Any]:
        return {
            "organization_id": self.organization.id,
            "user_id": self.requester.id,
            "target_user_id": recipient.id,
            "actor_id": recipient.id,
        }
