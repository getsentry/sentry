"""REST delivery for the formatter.

A mixin that adds a ``formatted`` field to an endpoint's JSON response when ``?llmFormat`` is
requested. Endpoints opt in by setting ``formatter_adapter`` (serialized response -> text).
Gated by the ``issues.standardized-markdown-for-llm`` option: when it's off the mixin is inert
and the response is untouched.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.issues.formatting.sections import Format, format_issue

if TYPE_CHECKING:
    # for typing, treat the super() chain as an Endpoint; runtime uses the real base via MRO
    from sentry.api.base import Endpoint

    _Base = Endpoint
else:
    _Base = object

logger = logging.getLogger(__name__)

FORMATTER_OPTION = "issues.standardized-markdown-for-llm"
# not "format": DRF reserves that query param for renderer content-negotiation
QUERY_PARAM = "llmFormat"
_VALID_FORMATS: tuple[Format, ...] = ("markdown", "xml")


class FormattableResponseMixin(_Base):
    # maps this endpoint's serialized response dict + format into rendered text
    formatter_adapter: Callable[[Mapping[str, Any], Format], str] | None = None

    def finalize_response(
        self, request: Request, response: Response, *args: Any, **kwargs: Any
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)

        adapter = self.formatter_adapter
        fmt = request.GET.get(QUERY_PARAM)
        if adapter is None or fmt not in _VALID_FORMATS or not options.get(FORMATTER_OPTION):
            return response
        if response.status_code != 200 or not isinstance(response.data, dict):
            return response

        try:
            content = adapter(response.data, fmt)
        except Exception:
            # never let formatting turn a good response into a 5xx
            logger.warning("formatter.render_failed", extra={"endpoint": type(self).__name__})
            return response

        response.data = {**response.data, "formatted": {"format": fmt, "content": content}}
        return response


def format_event_response(data: Mapping[str, Any], fmt: Format) -> str:
    """Adapter for event endpoints: the serialized event is what ``format_issue`` consumes."""
    return format_issue(data, format=fmt)
