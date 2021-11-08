from __future__ import annotations

import abc
import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence

from sentry import analytics, features, roles
from sentry.integrations.slack.utils.notifications import get_settings_url
from sentry.models import NotificationSetting, OrganizationMember, Team
from sentry.notifications.notifications.base import BaseNotification, MessageAction
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import NotificationSettingTypes
from sentry.types.integrations import ExternalProviders, get_provider_name

if TYPE_CHECKING:
    from sentry.integrations.slack.message_builder.organization_requests import (
        SlackOrganizationRequestMessageBuilder,
    )
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    analytics_event: str = ""
    referrer_base: str = ""
    member_by_user_id: MutableMapping[int, OrganizationMember] = {}

    def __init__(self, organization: Organization, requester: User) -> None:
        super().__init__(organization)
        self.requester = requester

    @property
    def SlackMessageBuilderClass(self) -> type[SlackOrganizationRequestMessageBuilder]:
        from sentry.integrations.slack.message_builder.organization_requests import (
            SlackOrganizationRequestMessageBuilder,
        )

        return SlackOrganizationRequestMessageBuilder

    def get_reference(self) -> Any:
        return self.organization

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_referrer(self, provider: ExternalProviders) -> str:
        # referrer needs the provider as well
        return f"{self.referrer_base}-{get_provider_name(provider)}"

    def get_sentry_query_params(self, provider: ExternalProviders) -> str:
        return f"?referrer={self.get_referrer(provider)}"

    def determine_recipients(self) -> Iterable[Team | User]:
        members = self.determine_member_recipients()
        # store the members in our cache
        for member in members:
            self.set_member_in_cache(member)
        # convert members to users
        return map(lambda member: member.user, members)

    def determine_member_recipients(self) -> Iterable[OrganizationMember]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        raise NotImplementedError

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        available_providers: Iterable[ExternalProviders] = {ExternalProviders.EMAIL}
        if features.has("organizations:slack-requests", self.organization):
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
            # TODO: use safe_excute
            notify(provider, self, recipients, context)

    def get_member(self, user: User) -> OrganizationMember:
        # cache the result
        if user.id not in self.member_by_user_id:
            self.member_by_user_id[user.id] = OrganizationMember.objects.get(
                user=user, organization=self.organization
            )
        return self.member_by_user_id[user.id]

    def set_member_in_cache(self, member: OrganizationMember) -> None:
        """
        A way to set a member in a cache to avoid a query.
        """
        self.member_by_user_id[member.user_id] = member

    def get_notification_title(self) -> str:
        # purposely use empty string for the notification title
        return ""

    def build_attachment_title(self) -> str:
        raise NotImplementedError

    def get_message_description(self) -> str:
        raise NotImplementedError

    def get_actions(self) -> Sequence[Mapping[str, str]]:
        return [message_action.as_slack() for message_action in self.get_message_actions()]

    def get_message_actions(self) -> Sequence[MessageAction]:
        raise NotImplementedError

    def get_role_string(self, member: OrganizationMember) -> str:
        role_string: str = roles.get(member.role).name
        return role_string

    def build_notification_footer(self, recipient: Team | User) -> str:
        # not implemented for teams
        if isinstance(recipient, Team):
            raise NotImplementedError
        recipient_member = self.get_member(recipient)
        settings_url = get_settings_url(self, recipient)
        return (
            "You are receiving this notification because you're listed as an organization "
            f"{self.get_role_string(recipient_member)} | <{settings_url}|Notification Settings>"
        )

    def record_notification_sent(self, recipient: Team | User, provider: ExternalProviders) -> None:
        # this event is meant to work for multiple providers but architecture
        # limitations mean we will fire individual for each provider
        analytics.record(
            self.analytics_event,
            organization_id=self.organization.id,
            user_id=self.requester.id,
            target_user_id=recipient.id,
            providers=provider,
        )
