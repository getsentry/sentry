from .integration_extension_configuration import IntegrationExtensionConfigurationView


class DiscordExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "discord"
    external_provider_key = "discord"

    def map_params_to_state(self, params):
        return {"use_configure": "1", **params}
