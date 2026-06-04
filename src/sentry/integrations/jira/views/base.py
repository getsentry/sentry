from csp.middleware import CSPMiddleware
from django.conf import settings
from django.views.generic import View

from sentry import options
from sentry.middleware.placeholder import placeholder_get_response
from sentry.web.helpers import render_to_response


class JiraSentryUIBaseView(View):
    """
    Base class for the UI of the Sentry integration in Jira.
    """

    html_file: str  # abstract

    def get_response(self, context):
        """
        Wrap the HTML rendered using the template at `self.html_file` in a Response and
        add the requisite CSP headers before returning it.
        """

        context["ac_js_src"] = "https://connect-cdn.atl-paas.net/all.js"
        sources = [
            self.request.GET.get("xdm_e"),
            options.get("system.url-prefix"),
        ]
        sources = [s for s in sources if s and ";" not in s]  # Filter out None and invalid sources

        csp_frame_ancestors = [
            "'self'",
        ] + sources
        csp_style_src = list(settings.CSP_STYLE_SRC)

        if settings.STATIC_FRONTEND_APP_URL.startswith("https://"):
            origin = "/".join(settings.STATIC_FRONTEND_APP_URL.split("/")[0:3])
            csp_style_src.append(origin)

        middleware = CSPMiddleware(placeholder_get_response)
        middleware.process_request(self.request)  # adds nonce

        response = render_to_response(self.html_file, context, self.request)
        response._csp_replace = {
            "frame-ancestors": csp_frame_ancestors,
            "style-src": csp_style_src,
        }

        middleware.process_response(self.request, response)
        return response
