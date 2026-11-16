import re

from django.http import HttpRequest, HttpResponse, HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.debug import sensitive_post_parameters
from django.views.generic import View

from sentry import options
from sentry.agent_handoff.claims import claim_handoff
from sentry.agent_handoff.codes import HandoffFlow, HandoffIPMismatch
from sentry.agent_handoff.flows import get_flow
from sentry.agent_handoff.runbook import (
    render_agent_runbook,
    render_claim_runbook,
    render_ip_mismatch_runbook,
)
from sentry.ratelimits import backend as ratelimiter
from sentry.utils import metrics
from sentry.utils.http import absolute_uri
from sentry.web.decorators import ai_machine_readable
from sentry.web.frontend.base import control_silo_view

_CLAIM_WINDOW = 60
_MAX_CLAIM_BYTES = 1024
_HANDOFF_CODE = re.compile(r"sntryh_[A-Za-z0-9_-]{43}")
_UNAVAILABLE = (
    "# Handoff Code Unavailable\n\nAsk the user to return to Sentry and copy a new prompt.\n"
)


def _markdown(body: str, *, status: int = 200) -> HttpResponse:
    return HttpResponse(body, status=status, content_type="text/markdown; charset=utf-8")


@control_silo_view
@ai_machine_readable
class AgentHandoffView(View):
    http_method_names = ["get", "post", "head", "options"]

    @method_decorator(csrf_exempt)
    @method_decorator(never_cache)
    @method_decorator(sensitive_post_parameters("handoff_code"))
    def dispatch(self, request: HttpRequest, *args: object, **kwargs: object) -> HttpResponseBase:
        response = super().dispatch(request, *args, **kwargs)
        response["Referrer-Policy"] = "no-referrer"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    def get(self, request: HttpRequest) -> HttpResponse:
        if request.GET.get("preview") == "1":
            response = self._preview(request)
            response["Content-Type"] = "text/plain; charset=utf-8"
            return response

        return _markdown(
            render_claim_runbook(claim_url=absolute_uri(reverse("sentry-agent-handoff")))
        )

    def _preview(self, request: HttpRequest) -> HttpResponse:
        try:
            flow = HandoffFlow(request.GET.get("flow", HandoffFlow.GUIDED_NEXT_STEPS))
        except ValueError:
            return _markdown(
                "# Unknown Handoff Flow\n\nChoose a supported handoff flow.\n", status=400
            )

        return _markdown(
            render_agent_runbook(
                organization_slug="example-org",
                organization_name="Example Organization",
                user_email="user@example.com",
                sentry_url=options.get("system.url-prefix"),
                client_id="<client-id>",
                setup_code="<setup-code>",
                flow_instructions=get_flow(flow).preview(),
            )
        )

    def post(self, request: HttpRequest) -> HttpResponse:
        if ratelimiter.is_limited(
            f"agent-handoff:claim:{request.META.get('REMOTE_ADDR', 'unknown')}",
            limit=10,
            window=_CLAIM_WINDOW,
        ):
            response = _markdown(
                "# Try Again Shortly\n\nWait 60 seconds, then retry the same handoff code.\n",
                status=429,
            )
            response["Retry-After"] = str(_CLAIM_WINDOW)
            return response

        content_length = request.META.get("CONTENT_LENGTH", "0")
        if not content_length.isdigit() or int(content_length) > _MAX_CLAIM_BYTES:
            return _markdown(_UNAVAILABLE, status=400)
        if (
            request.content_type != "application/x-www-form-urlencoded"
            or len(request.body) > _MAX_CLAIM_BYTES
        ):
            return _markdown(_UNAVAILABLE, status=400)
        code = request.POST.get("handoff_code", "")
        if not _HANDOFF_CODE.fullmatch(code):
            return _markdown(_UNAVAILABLE, status=400)

        try:
            guide = claim_handoff(code, ip_address=request.META.get("REMOTE_ADDR"))
        except HandoffIPMismatch:
            metrics.incr("agent_handoff.claim.ip_mismatch", sample_rate=1.0)
            return _markdown(render_ip_mismatch_runbook(), status=403)
        if guide is None:
            return _markdown(_UNAVAILABLE, status=410)
        return _markdown(guide)
