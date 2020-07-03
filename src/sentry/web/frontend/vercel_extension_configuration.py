from __future__ import absolute_import


from sentry import features
from .integration_extension_configuration import IntegrationExtensionConfigurationView


class VercelExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vercel"
    external_provider_key = "vercel"

    def is_enabled_for_org(self, org, user):
        return features.has("organizations:integrations-vercel", org, actor=user)
