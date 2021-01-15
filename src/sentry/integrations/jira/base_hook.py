from __future__ import absolute_import


from django.views.generic import View

from sentry.web.helpers import render_to_response
from sentry import options


class JiraBaseHook(View):
    def get_response(self, context):
        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        res = render_to_response(self.html_file, context, self.request)
        # we aren't actually displaying it on the same page but we don't want to set it to deny
        # which security.py will do
        res["X-Frame-Options"] = "SAMEORIGIN"
        res["Content-Security-Policy"] = u"frame-ancestors 'self' %s %s" % (
            self.request.GET["xdm_e"],
            options.get("system.url-prefix"),
        )
        return res
