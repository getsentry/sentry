from __future__ import absolute_import


from sentry import features
from .integration_extension_configuration import IntegrationExtensionConfigurationView


class MsTeamsExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "msteams"
    external_provider_key = "msteams"

    def is_enabled_for_org(self, org, user):
        return features.has("organizations:integrations-msteams", org, actor=user)
