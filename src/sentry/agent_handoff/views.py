from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.generic import View

from sentry.agent_handoff.runbook import render_claim_runbook
from sentry.web.decorators import ai_machine_readable
from sentry.web.frontend.base import control_silo_view


@control_silo_view
@ai_machine_readable
class AgentHandoffView(View):
    http_method_names = ["get", "head", "options"]

    @method_decorator(never_cache)
    def dispatch(self, request: HttpRequest, *args: object, **kwargs: object) -> HttpResponseBase:
        response = super().dispatch(request, *args, **kwargs)
        response["Referrer-Policy"] = "no-referrer"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def get(self, request: HttpRequest) -> HttpResponse:
        return HttpResponse(render_claim_runbook(), content_type="text/markdown; charset=utf-8")
