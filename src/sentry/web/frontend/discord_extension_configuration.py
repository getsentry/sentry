from .integration_extension_configuration import IntegrationExtensionConfigurationView


class DiscordExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "discord"
    external_provider_key = "discord"
