from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any

from sentry.integrations.messaging.linkage import IdentityLinkageView, LinkageView
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.utils.notifications import (
    SlackCommandResponse,
    respond_to_slack_command,
)
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders

from . import SALT


class SlackLinkageView(LinkageView, ABC):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.slack.spec import SlackMessagingSpec

        return SlackMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.SLACK

    @property
    def external_provider_enum(self) -> ExternalProviderEnum:
        return ExternalProviderEnum.SLACK

    @property
    def salt(self) -> str:
        return SALT


class SlackIdentityLinkageView(SlackLinkageView, IdentityLinkageView, ABC):
    @property
    def external_id_parameter(self) -> str:
        return "slack_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/slack/expired-link.html"

    def notify_on_success(
        self, external_id: str, params: Mapping[str, Any], integration: Integration | None
    ) -> None:
        if integration is None:
            raise ValueError(
                'integration is required for linking (params must include "integration_id")'
            )
        respond_to_slack_command(
            self.command_response, integration, external_id, params.get("response_url")
        )

    @property
    @abstractmethod
    def command_response(self) -> SlackCommandResponse:
        raise NotImplementedError
