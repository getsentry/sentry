from django.views.generic import View

from sentry import options
from sentry.web.helpers import render_to_response


class JiraBaseHook(View):
    def get_response(self, context):
        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        response = render_to_response(self.html_file, context, self.request)
        sources = [
            self.request.GET.get("xdm_e"),
            options.get("system.url-prefix"),
        ]
        sources_string = " ".join(s for s in sources if s)  # Filter out None
        response["Content-Security-Policy"] = f"frame-ancestors 'self' {sources_string}"
        return response
