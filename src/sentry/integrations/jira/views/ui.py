from jwt import ExpiredSignatureError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.utils import AtlassianConnectValidationError, get_integration_from_request
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from . import UNABLE_TO_VERIFY_INSTALLATION, JiraBaseHook


class JiraUiHookView(JiraBaseHook):
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
            "metadata": json.dumps(integration.metadata),
        }
        finish_link = "{}.?signed_params={}".format(
            absolute_uri("/extensions/jira/configure/"), sign(**signed_data)
        )

        image_path = absolute_uri(get_asset_url("sentry", "images/sentry-glyph-black.png"))
        return self.get_response({"finish_link": finish_link, "image_path": image_path})
