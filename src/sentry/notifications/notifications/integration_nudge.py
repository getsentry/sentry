from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence

from sentry.db.models import Model
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Organization, User

logger = logging.getLogger(__name__)

MESSAGE_LIBRARY = [
    "Check your email lately? We didn't think so. Get Sentry notifications in {provider}.",
    "Complicated relationship with email? We understand. We can notify you in {provider} instead.",
    "Dread email? We get it. Hear from Sentry in {provider} instead.",
    "Emails are so 2010s. Get Sentry notifications in {provider}.",
    "Everyone has feelings about notifications. Whatever yours are, get your"
    " needs met with Sentry for {provider}.",
    "Get notifications where you'll actually see them. Hear from Sentry in {provider}.",
    "Is this a dream come true? Or notifications out of control? Hear from"
    " Sentry right here in {provider}. If you want.",
    "Like getting notified in {provider}? Sentry can do that. Want to be left alone? Ignore this.",
    "Like this notification? There's more where that came from. Hear from Sentry right here in {provider}.",
    "Notifications aren't always bad. Hear from Sentry right here in {provider}.",
    "Remember when email was exciting? It's not 1998 anymore. Get notified in {provider} instead.",
    "Reminisce on the days before your email address was an obligational burden"
    " while signing up for {provider} notifications instead.",
    "This is a notification about notifications. Now you can hear from Sentry right here in {provider}.",
    "This isn't 1998. Swap emails for Sentry notifications in {provider}.",
    "We're doing something new. Get Sentry notifications right here in {provider}.",
    "We're here to notify you about notifications. Meta, huh? Hear from Sentry right here in {provider}.",
    "We've got something new for you. Get Sentry notifications right here in {provider}.",
    "Who even checks their email anymore? Get Sentry notifications in {provider}.",
    "You've got mail. So much mail. You're lost and confused as you cut through"
    " a jungle of mail. Sentry can notify you in {provider} instead.",
]


class IntegrationNudgeNotification(BaseNotification):
    metrics_key = "integration_nudge"
    template_path = "integration-nudge"
    type = "integration.nudge"

    def __init__(
        self,
        organization: Organization,
        recipient: User,
        provider: ExternalProviders,
        seed: int | None = None,
    ) -> None:
        super().__init__(organization)
        self.recipient = recipient
        self.provider = provider
        self.seed = (
            (seed % len(MESSAGE_LIBRARY))
            if seed is not None
            else random.randint(0, len(MESSAGE_LIBRARY) - 1)
        )

    @property
    def reference(self) -> Model | None:
        return None

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[RpcActor]]:
        return {self.provider: {self.recipient}}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return ""

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> Any:
        return MESSAGE_LIBRARY[self.seed].format(provider=self.provider.name.capitalize())

    def get_message_actions(
        self, recipient: RpcActor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        return [
            MessageAction(
                name="Turn on personal notifications",
                action_id="enable_notifications",
                value="all_slack",
            )
        ]

    def get_callback_data(self) -> Mapping[str, Any]:
        # Arbitrary payload to provide slack a callback id
        return {"enable_notifications": True}

    def get_context(self) -> MutableMapping[str, Any]:
        return {}

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return ""

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return ""

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        return ""

    def record_notification_sent(self, recipient: RpcActor, provider: ExternalProviders) -> None:
        pass

    def get_log_params(self, recipient: RpcActor) -> Mapping[str, Any]:
        return {"seed": self.seed, **super().get_log_params(recipient)}
