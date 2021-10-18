import abc
import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence, Type, Union

from sentry import analytics, features
from sentry.integrations.slack.utils.notifications import get_settings_url
from sentry.models import OrganizationMember, Team
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import notification_providers
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.integrations.slack.message_builder.organization_requests import (
        SlackOrganizationRequestMessageBuilder,
    )
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)


class OrganizationRequestNotification(BaseNotification, abc.ABC):
    analytics_event: str = ""

    def __init__(self, organization: "Organization", requester: "User") -> None:
        self.organization = organization
        self.requester = requester

    @property
    def SlackMessageBuilderClass(self) -> Type["SlackOrganizationRequestMessageBuilder"]:
        from sentry.integrations.slack.message_builder.organization_requests import (
            SlackOrganizationRequestMessageBuilder,
        )

        return SlackOrganizationRequestMessageBuilder

    def get_context(self) -> MutableMapping[str, Any]:
        raise NotImplementedError

    def determine_recipients(self) -> Iterable[Union["Team", "User"]]:
        """
        Depending on the type of request this might be all organization owners,
        a specific person, or something in between.
        """
        raise NotImplementedError

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
        available_providers: Iterable[ExternalProviders] = {ExternalProviders.EMAIL}
        if not features.has("organizations:slack-requests", self.organization):
            available_providers = notification_providers()

        # TODO: need to read off notification settings
        recipients = self.determine_recipients()
        output = {
            provider: [recepient for recepient in recipients] for provider in available_providers
        }

        return output

    def send(self) -> None:
        from sentry.notifications.notify import notify

        participants_by_provider = self.get_participants()
        if not participants_by_provider:
            return

        for provider, recipients in participants_by_provider.items():
            notify(provider, self, recipients, self.get_context())

    def get_member(self, user: "User") -> "OrganizationMember":
        # TODO: add caching
        return OrganizationMember.objects.get(user=user, organization=self.organization)

    def build_attachment_title(self) -> str:
        raise NotImplementedError

    def get_message_description(self) -> str:
        raise NotImplementedError

    def get_actions(self) -> Sequence[Mapping[str, str]]:
        raise NotImplementedError

    def build_notification_footer(self, recipient: Union["Team", "User"]) -> str:
        # not implemented for teams
        if isinstance(recipient, Team):
            raise NotImplementedError
        recipient_member = self.get_member(recipient)
        settings_url = get_settings_url(self, recipient)
        return f"""You are receiving this notification because you're listed
                    as an organization {recipient_member.role} | <{settings_url}|Notification Settings>"""

    def record_notification_sent(
        self, recipient: Union["Team", "User"], provider: ExternalProviders
    ) -> None:
        # this event is meant to work for multiple providers but architecture
        # limitations mean we will fire individual for each provider
        analytics.record(
            self.analytics_event,
            organization_id=self.organization.id,
            user_id=self.requester.id,
            target_user_id=recipient.id,
            providers=provider,
        )
