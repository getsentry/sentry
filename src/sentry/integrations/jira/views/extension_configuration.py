from sentry.utils import json
from sentry.utils.signing import unsign
from sentry.web.frontend.integration_extension_configuration import (
    IntegrationExtensionConfigurationView,
)

# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24


class JiraExtensionConfigurationView(IntegrationExtensionConfigurationView):
    """
    Handle the UI for adding the Jira integration to a Sentry org.
    """

    provider = "jira"
    external_provider_key = "jira"

    def map_params_to_state(self, original_params):
        # decode the signed params and add them to whatever params we have
        params = original_params.copy()
        signed_params = params.pop("signed_params", {})
        params.update(
            unsign(
                signed_params,
                max_age=INSTALL_EXPIRATION_TIME,
            )
        )
        params["metadata"] = json.loads(params["metadata"])
        return params
