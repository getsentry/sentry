from jwt import ExpiredSignatureError

from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from .base_hook import JiraBaseHook


class JiraUiHookView(JiraBaseHook):
    html_file = "sentry/integrations/jira-config.html"

    def get(self, request, *args, **kwargs):
        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError:
            return self.get_response({"error_message": "Unable to verify installation."})
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
