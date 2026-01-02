from sentry.web.frontend.base import control_silo_view

from .integration_extension_configuration import IntegrationExtensionConfigurationView


@control_silo_view
class VercelExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vercel"
    external_provider_key = "vercel"
