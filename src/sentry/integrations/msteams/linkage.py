from abc import ABC

from sentry.integrations.messaging.linkage import IdentityLinkageView
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders


class MsTeamsIdentityLinkageView(IdentityLinkageView, ABC):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.msteams.spec import MsTeamsMessagingSpec

        return MsTeamsMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.MSTEAMS

    @property
    def external_provider_enum(self) -> ExternalProviderEnum:
        return ExternalProviderEnum.MSTEAMS

    @property
    def salt(self) -> str:
        from .constants import SALT

        return SALT

    @property
    def external_id_parameter(self) -> str:
        return "teams_user_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/msteams/expired-link.html"
