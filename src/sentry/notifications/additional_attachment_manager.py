from __future__ import annotations

from collections.abc import Callable, MutableMapping

from sentry.integrations.api.parsers.integrations import validate_provider
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.message_builder.types import SlackBlock
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization

GetAttachment = Callable[
    [Integration | RpcIntegration, Organization | RpcOrganization], list[SlackBlock]
]


class AttachmentGeneratorAlreadySetException(Exception):
    pass


class AdditionalAttachmentManager:
    def __init__(self) -> None:
        self.attachment_generators: MutableMapping[ExternalProviders, GetAttachment] = {}

    # need to update types for additional providers
    def get_additional_attachment(
        self,
        integration: Integration | RpcIntegration,
        organization: Organization | RpcOrganization,
    ) -> list[SlackBlock] | None:
        # look up the generator by the provider but only accepting slack for now
        provider = validate_provider(integration.provider, {ExternalProviders.SLACK})
        attachment_generator = self.attachment_generators.get(provider)
        if attachment_generator is None:
            return None
        return attachment_generator(integration, organization)

    def register_additional_attachment_generator(
        self,
        provider: ExternalProviders,
    ) -> Callable[[GetAttachment], GetAttachment]:
        if self.attachment_generators.get(provider):
            raise AttachmentGeneratorAlreadySetException()

        def wrapped(attachment_generator: GetAttachment) -> GetAttachment:
            self.attachment_generators[provider] = attachment_generator
            return attachment_generator

        return wrapped


# make instance and export it
manager = AdditionalAttachmentManager()
register_additional_attachment_generator = manager.register_additional_attachment_generator
get_additional_attachment = manager.get_additional_attachment
