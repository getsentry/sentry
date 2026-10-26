from __future__ import annotations

from collections.abc import Callable, Collection, MutableMapping
from typing import TYPE_CHECKING

from sentry.integrations.api.parsers.integrations import validate_provider
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization

# Provider packages import this module, so importing their types at runtime is circular.
if TYPE_CHECKING:
    from sentry.integrations.discord.message_builder.base.embed.base import (
        DiscordMessageEmbedDict,
    )
    from sentry.integrations.msteams.card_builder.block import Block
    from sentry.integrations.slack.message_builder.types import SlackBlock

type GetAttachment[T] = Callable[
    [Integration | RpcIntegration, Organization | RpcOrganization], list[T] | None
]


class AttachmentGeneratorAlreadySetException(Exception):
    pass


class AdditionalAttachmentManager[T]:
    """
    Lets getsentry add provider-specific content, such as plan warnings, to messages sent through
    an integration. Each provider's messages take a different content type, so each has its own
    manager.
    """

    def __init__(self, providers: Collection[ExternalProviders]) -> None:
        self.providers = set(providers)
        self.attachment_generators: MutableMapping[ExternalProviders, GetAttachment[T]] = {}

    def get_additional_attachment(
        self,
        integration: Integration | RpcIntegration,
        organization: Organization | RpcOrganization,
    ) -> list[T] | None:
        provider = validate_provider(integration.provider, self.providers)
        attachment_generator = self.attachment_generators.get(provider)
        if attachment_generator is None:
            return None
        return attachment_generator(integration, organization)

    def register_additional_attachment_generator(
        self,
        provider: ExternalProviders,
    ) -> Callable[[GetAttachment[T]], GetAttachment[T]]:
        if self.attachment_generators.get(provider):
            raise AttachmentGeneratorAlreadySetException()

        def wrapped(attachment_generator: GetAttachment[T]) -> GetAttachment[T]:
            self.attachment_generators[provider] = attachment_generator
            return attachment_generator

        return wrapped


manager: AdditionalAttachmentManager[SlackBlock] = AdditionalAttachmentManager(
    {ExternalProviders.SLACK, ExternalProviders.SLACK_STAGING}
)
register_additional_attachment_generator = manager.register_additional_attachment_generator
get_additional_attachment = manager.get_additional_attachment

discord_attachment_manager: AdditionalAttachmentManager[DiscordMessageEmbedDict] = (
    AdditionalAttachmentManager({ExternalProviders.DISCORD})
)
msteams_attachment_manager: AdditionalAttachmentManager[Block] = AdditionalAttachmentManager(
    {ExternalProviders.MSTEAMS}
)
