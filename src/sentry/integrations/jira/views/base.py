from csp.middleware import CSPMiddleware
from django.conf import settings
from django.views.generic import View

from sentry import options
from sentry.web.helpers import render_to_response


class JiraSentryUIBaseView(View):
    """
    Base class for the UI of the Sentry integration in Jira.
    """

    def get_response(self, context):
        """
        Wrap the HTML rendered using the template at `self.html_file` in a Response and
        add the requisite CSP headers before returning it.
        """

        sources = [
            self.request.GET.get("xdm_e"),
            options.get("system.url-prefix"),
        ]

        settings.CSP_FRAME_ANCESTORS = [
            "'self'",
        ] + [s for s in sources if s and ";" not in s]
        settings.CSP_STYLE_SRC = [
            # same as default (server.py)
            "'self'",
            "'unsafe-inline'",
        ]

        if settings.STATIC_FRONTEND_APP_URL.startswith("https://"):
            origin = "/".join(settings.STATIC_FRONTEND_APP_URL.split("/")[0:3])
            settings.CSP_STYLE_SRC.append(origin)

        header = "Content-Security-Policy"
        if getattr(settings, "CSP_REPORT_ONLY", False):
            header += "-Report-Only"

        middleware = CSPMiddleware()
        middleware.process_request(self.request)  # adds nonce

        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        response = render_to_response(self.html_file, context, self.request)

        response[header] = middleware.build_policy(request=self.request, response=response)
        return response
