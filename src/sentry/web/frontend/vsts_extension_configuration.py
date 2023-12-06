from sentry.web.frontend.base import control_silo_view

from .integration_extension_configuration import IntegrationExtensionConfigurationView


@control_silo_view
class VstsExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vsts"
    external_provider_key = "vsts-extension"

    def map_params_to_state(self, params):
        return {"accountId": params["targetId"], "accountName": params["targetName"]}
