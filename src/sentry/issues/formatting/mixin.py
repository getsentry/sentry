"""REST delivery for the formatter.

A mixin that adds a ``formatted`` field to an endpoint's JSON response when ``?llmFormat`` is
requested. Endpoints opt in by setting ``formatter_adapter`` (serialized response -> text).
Gated by the ``organizations:issue-standardized-markdown-for-llm`` feature: when it's off the
mixin is inert and the response is untouched.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any, get_args

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.issues.formatting.formatter import Format
from sentry.issues.formatting.limits import LIMITS_LOW
from sentry.issues.formatting.sections import EVENT_SECTIONS_WITH_USER, format_issue

if TYPE_CHECKING:
    # for typing, treat the super() chain as an Endpoint; runtime uses the real base via MRO
    from sentry.api.base import Endpoint

    _Base = Endpoint
else:
    _Base = object

logger = logging.getLogger(__name__)

FORMATTER_FEATURE = "organizations:issue-standardized-markdown-for-llm"
# API clients ramp separately from the UI. They share these endpoints and the same query param
# but not the same content needs: the UI wants breadcrumbs inlined, while the MCP deliberately
# leaves them to its own tool. The MCP is the only API consumer of ``?llmFormat`` today.
FORMATTER_FEATURE_API = "organizations:issue-standardized-markdown-for-llm-api"
# not "format": DRF reserves that query param for renderer content-negotiation
QUERY_PARAM = "llmFormat"
VALID_FORMATS: tuple[Format, ...] = get_args(Format)


def formatter_feature_for(request: Request) -> str:
    """Pick the rollout feature for this caller.

    ``auth`` is unset for the Sentry UI (session cookies) and for viewer-context callers, which
    null it on purpose to borrow session semantics; a token or key means an API client. An
    unrecognised caller lands on the API feature deliberately -- it is the narrower rollout, so
    a new consumer can't inherit the UI's wider one just by not being recognised.

    Auth type is a proxy for the caller, not the caller itself: an agent-token request would be
    classified as an API client even though Seer belongs with the UI. That costs nothing today
    because Seer reads the formatter over RPC rather than through this mixin, but a Seer caller
    arriving here would need naming explicitly rather than inferring from auth.
    """
    return FORMATTER_FEATURE if request.auth is None else FORMATTER_FEATURE_API


class FormattableResponseMixin(_Base):
    # maps this endpoint's serialized response dict + format into rendered text
    formatter_adapter: Callable[[Mapping[str, Any], Format], str] | None = None

    def finalize_response(
        self, request: Request, response: Response, *args: Any, **kwargs: Any
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)

        adapter = self.formatter_adapter
        fmt = request.GET.get(QUERY_PARAM)
        organization = getattr(request, "organization", None)
        if (
            adapter is None
            or fmt not in VALID_FORMATS
            or organization is None
            or not features.has(formatter_feature_for(request), organization, actor=request.user)
        ):
            return response
        if response.status_code != 200 or not isinstance(response.data, dict):
            return response

        try:
            content = adapter(response.data, fmt)
        except Exception:
            # never let formatting turn a good response into a 5xx, but keep the traceback:
            # this path degrades silently, so without it a formatter bug is undiagnosable
            logger.exception("formatter.render_failed", extra={"endpoint": type(self).__name__})
            return response

        response.data = {**response.data, "formatted": {"format": fmt, "content": content}}
        return response


def format_event_response(data: Mapping[str, Any], fmt: Format) -> str:
    """Adapter for event endpoints: the serialized event is what ``format_issue`` consumes.

    Renders with the low limits because every ``?llmFormat`` consumer pastes into a model's
    context (Copy to Markdown, the MCP), and these caps are what the copy-markdown builder
    already applies client-side. Callers that want the default profile use ``format_issue``
    directly, as the Seer RPC does.

    Opts into the user identifiers the default section list holds back: this response already
    carries ``user`` in full, so rendering it adds nothing the caller can't already read.
    """
    return format_issue(data, format=fmt, sections=EVENT_SECTIONS_WITH_USER, limits=LIMITS_LOW)
