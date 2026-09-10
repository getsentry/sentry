"""REST delivery for the formatter.

A mixin that adds a ``formatted`` field to an endpoint's JSON response when ``?llmFormat`` is
requested. Endpoints opt in by setting ``formatter_adapter`` (serialized response + format +
consumer -> text). Gated by the ``organizations:issue-standardized-markdown-for-llm`` feature
(``-api`` for API clients): when it's off the mixin is inert and the response is untouched.

The adapter is told which consumer it is rendering for, because the two want different content
from the same endpoint -- see ``format_event_response``.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any, get_args

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.issues.formatting.formatter import Consumer, Format
from sentry.issues.formatting.limits import LIMITS_LOW
from sentry.issues.formatting.sections import (
    EVENT_SECTIONS_WITH_USER,
    breadcrumbs_section,
    format_issue,
)

if TYPE_CHECKING:
    # for typing, treat the super() chain as an Endpoint; runtime uses the real base via MRO
    from sentry.api.base import Endpoint

    _Base = Endpoint
else:
    _Base = object

logger = logging.getLogger(__name__)

FORMATTER_FEATURE = "organizations:issue-standardized-markdown-for-llm"
# API clients (just the MCP today) ramp separately from the UI
FORMATTER_FEATURE_API = "organizations:issue-standardized-markdown-for-llm-api"
# not "format": DRF reserves that query param for renderer content-negotiation
QUERY_PARAM = "llmFormat"
VALID_FORMATS: tuple[Format, ...] = get_args(Format)


_CONSUMER_FEATURES: dict[Consumer, str] = {
    "ui": FORMATTER_FEATURE,
    "api": FORMATTER_FEATURE_API,
}


def consumer_for(request: Request) -> Consumer:
    """Session and viewer-context callers are the UI; a token or key is an API client.

    An unrecognised caller lands on ``"api"`` deliberately: it is the narrower rollout.
    """
    return "ui" if request.auth is None else "api"


def formatter_feature_for(request: Request) -> str:
    return _CONSUMER_FEATURES[consumer_for(request)]


class FormattableResponseMixin(_Base):
    # maps this endpoint's serialized response dict + format + consumer into rendered text
    formatter_adapter: Callable[[Mapping[str, Any], Format, Consumer], str] | None = None

    def finalize_response(
        self, request: Request, response: Response, *args: Any, **kwargs: Any
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)

        adapter = self.formatter_adapter
        fmt = request.GET.get(QUERY_PARAM)
        organization = getattr(request, "organization", None)
        consumer = consumer_for(request)
        if (
            adapter is None
            or fmt not in VALID_FORMATS
            or organization is None
            or not features.has(_CONSUMER_FEATURES[consumer], organization, actor=request.user)
        ):
            return response
        if response.status_code != 200 or not isinstance(response.data, dict):
            return response

        try:
            content = adapter(response.data, fmt, consumer)
        except Exception:
            # never let formatting turn a good response into a 5xx, but keep the traceback:
            # this path degrades silently, so without it a formatter bug is undiagnosable
            logger.exception("formatter.render_failed", extra={"endpoint": type(self).__name__})
            return response

        response.data = {**response.data, "formatted": {"format": fmt, "content": content}}
        return response


# Sections an API client does not want inlined, even though the UI does.
#
# Breadcrumbs: the MCP keeps them out of issue details on purpose and exposes them through its
# own ``get_issue_breadcrumbs`` tool. Inlining them here would duplicate that tool and add up to
# ``max_breadcrumbs_chars`` (5k) to every issue-details call whether the caller wants them or
# not, which is the cost that split exists to avoid.
_SECTIONS_EXCLUDED_FOR_API = frozenset({breadcrumbs_section})

_SECTIONS_BY_CONSUMER: dict[Consumer, list[Any]] = {
    "ui": EVENT_SECTIONS_WITH_USER,
    "api": [s for s in EVENT_SECTIONS_WITH_USER if s not in _SECTIONS_EXCLUDED_FOR_API],
}


def format_event_response(data: Mapping[str, Any], fmt: Format, consumer: Consumer = "ui") -> str:
    """Adapter for event endpoints: the serialized event is what ``format_issue`` consumes.

    Renders with the low limits because every ``?llmFormat`` consumer pastes into a model's
    context (Copy to Markdown, the MCP), and these caps are what the copy-markdown builder
    already applies client-side. Callers that want the default profile use ``format_issue``
    directly, as the Seer RPC does.

    Opts into the user identifiers the default section list holds back: this response already
    carries ``user`` in full, so rendering it adds nothing the caller can't already read.
    """
    return format_issue(
        data, format=fmt, sections=_SECTIONS_BY_CONSUMER[consumer], limits=LIMITS_LOW
    )
