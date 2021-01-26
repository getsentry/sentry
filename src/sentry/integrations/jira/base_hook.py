from django.views.generic import View

from sentry.web.helpers import render_to_response
from sentry import options


class JiraBaseHook(View):
    def get_response(self, context):
        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        res = render_to_response(self.html_file, context, self.request)
        # COOP blocks the Jira glance view links from opening
        res["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        res["Content-Security-Policy"] = "frame-ancestors 'self' %s %s" % (
            self.request.GET["xdm_e"],
            options.get("system.url-prefix"),
        )
        return res
