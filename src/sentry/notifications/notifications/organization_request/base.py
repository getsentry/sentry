from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence, Type

from sentry import roles
from sentry.models import NotificationSetting, OrganizationMember, Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.strategies.role_based_recipient_strategy import (
    RoleBasedRecipientStrategy,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import NotificationSettingTypes
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    referrer_base: str = ""
    member_by_user_id: MutableMapping[int, OrganizationMember] = {}
    fine_tuning_key = "approval"
    RoleBasedRecipientStrategyClass: Type[RoleBasedRecipientStrategy]

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester
        self.role_based_recipient_strategy = self.RoleBasedRecipientStrategyClass(organization)

    def get_reference(self) -> Any:
        return self.organization

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_referrer(self, provider: ExternalProviders, recipient: Team | User) -> str:
        # referrer needs the provider and recipient
        recipient_type = recipient.__class__.__name__.lower()
        return f"{self.referrer_base}-{EXTERNAL_PROVIDERS[provider]}-{recipient_type}"

    def get_sentry_query_params(self, provider: ExternalProviders, recipient: Team | User) -> str:
        return f"?referrer={self.get_referrer(provider, recipient)}"

    def determine_recipients(self) -> Iterable[Team | User]:
        return self.role_based_recipient_strategy.determine_recipients()

    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        raise NotImplementedError

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        available_providers = notification_providers()
        recipients = list(self.determine_recipients())
        recipients_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(
            self.organization, recipients, NotificationSettingTypes.APPROVAL
        )

        return {
            provider: recipients_of_provider
            for provider, recipients_of_provider in recipients_by_provider.items()
            if provider in available_providers
        }

    def send(self) -> None:
        from sentry.notifications.notify import notify

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            return

        context = self.get_context()
        for provider, recipients in participants_by_provider.items():
            # TODO: use safe_execute
            notify(provider, self, recipients, context)

    def get_notification_title(self) -> str:
        # purposely use empty string for the notification title
        return ""

    def build_attachment_title(self) -> str:
        raise NotImplementedError

    def get_message_description(self) -> str:
        raise NotImplementedError

    def get_message_actions(self, recipient: Team | User) -> Sequence[MessageAction]:
        raise NotImplementedError

    def get_role_string(self, member: OrganizationMember) -> str:
        role_string: str = roles.get(member.role).name
        return role_string

    def build_notification_footer(self, recipient: Team | User) -> str:
        from sentry.integrations.slack.utils.notifications import get_settings_url

        if isinstance(recipient, Team):
            raise NotImplementedError

        settings_url = get_settings_url(self, recipient)
        return self.role_based_recipient_strategy.build_notification_footer_from_settings_url(
            settings_url, recipient
        )

    def get_title_link(self) -> str | None:
        return None

    def get_log_params(self, recipient: Team | User) -> MutableMapping[str, Any]:
        if isinstance(recipient, Team):
            raise NotImplementedError

        return {
            **super().get_log_params(recipient),
            "user_id": self.requester.id,
            "target_user_id": recipient.id,
        }
