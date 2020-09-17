from __future__ import absolute_import


from jwt import ExpiredSignatureError

from django.views.generic import View

from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.utils import json
from sentry.utils.signing import sign
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response


class JiraUiHookView(View):
    def get_response(self, context):
        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        res = render_to_response("sentry/integrations/jira-config.html", context, self.request)
        res["Content-Security-Policy"] = u"frame-ancestors %s" % self.request.GET["xdm_e"]
        return res

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
        finish_link = u"{}.?signed_params={}".format(
            absolute_uri("/extensions/jira/configure/"), sign(**signed_data)
        )
        return self.get_response({"finish_link": finish_link})
