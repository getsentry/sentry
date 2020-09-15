from __future__ import absolute_import

from sentry import features
from sentry.utils.signing import unsign

from .integration_extension_configuration import IntegrationExtensionConfigurationView


# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24


class MsTeamsExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "msteams"
    external_provider_key = "msteams"

    def is_enabled_for_org(self, org, user):
        return features.has("organizations:integrations-msteams", org, actor=user)

    def map_params_to_state(self, params):
        # decode the signed params and add them to whatever params we have
        params = params.copy()
        signed_params = params["signed_params"]
        del params["signed_params"]
        params.update(unsign(signed_params, max_age=INSTALL_EXPIRATION_TIME,))
        return params
