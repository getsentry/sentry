from sentry.constants import INSTALL_EXPIRATION_TIME
from sentry.utils.signing import unsign
from sentry.web.frontend.integration_extension_configuration import (
    IntegrationExtensionConfigurationView,
)


class GithubExtensionConfigurationView(IntegrationExtensionConfigurationView):
    provider = "github"
    external_provider_key = "github-extension"

    def map_params_to_state(self, params):
        # decode the signed params and add them to whatever params we have
        params = params.copy()
        signed_params = params["signed_params"]
        del params["signed_params"]
        params.update(
            unsign(
                signed_params,
                max_age=INSTALL_EXPIRATION_TIME,
            )
        )
        return params
