from sentry.integrations.types import IntegrationProviderSlug

from .integration_extension_configuration import IntegrationExtensionConfigurationView


class DiscordExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = IntegrationProviderSlug.DISCORD.value
    external_provider_key = IntegrationProviderSlug.DISCORD.value

    def map_params_to_state(self, params):
        return {"use_configure": "1", **params}
