from __future__ import absolute_import


from .integration_extension_configuration import IntegrationExtensionConfigurationView


class VstsExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "vsts"
    external_provider_key = "vsts-extension"

    def map_params_to_state(self, params):
        return {"accountId": params["targetId"], "accountName": params["targetName"]}
