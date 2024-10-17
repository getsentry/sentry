import orjson
from jwt import ExpiredSignatureError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign
from sentry.web.frontend.base import control_silo_view

from . import SALT, UNABLE_TO_VERIFY_INSTALLATION, JiraSentryUIBaseView


@control_silo_view
class JiraSentryInstallationView(JiraSentryUIBaseView):
    """
    Handles requests (from the Sentry integration in Jira) for HTML to display when
    setting up the integration in the Jira UI.
    """

    html_file = "sentry/integrations/jira-config.html"

    def get(self, request: Request, *args, **kwargs) -> Response:
        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError:
            return self.get_response({"error_message": UNABLE_TO_VERIFY_INSTALLATION})
        except ExpiredSignatureError:
            return self.get_response({"refresh_required": True})

        # expose a link to the configuration view
        signed_data = {
            "external_id": integration.external_id,
            "metadata": orjson.dumps(integration.metadata).decode(),
        }
        finish_link = "{}.?signed_params={}".format(
            absolute_uri("/extensions/jira/configure/"), sign(salt=SALT, **signed_data)
        )

        image_path = absolute_uri(get_asset_url("sentry", "images/sentry-glyph-black.png"))
        return self.get_response({"finish_link": finish_link, "image_path": image_path})
