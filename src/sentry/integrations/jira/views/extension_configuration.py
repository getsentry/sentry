import orjson

from sentry.integrations.web.integration_extension_configuration import (
    IntegrationExtensionConfigurationView,
)
from sentry.utils.signing import unsign
from sentry.web.frontend.base import control_silo_view

from . import SALT

# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24


@control_silo_view
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
                salt=SALT,
            )
        )
        params["metadata"] = orjson.loads(params["metadata"])
        return params
