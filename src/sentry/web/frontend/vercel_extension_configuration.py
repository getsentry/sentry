from __future__ import absolute_import


from .integration_extension_configuration import IntegrationExtensionConfigurationView


class VercelExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vercel"
    external_provider_key = "vercel"
