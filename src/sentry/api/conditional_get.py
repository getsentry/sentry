from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any

from django.utils.cache import patch_vary_headers
from django.utils.http import parse_etags
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.utils import metrics

if TYPE_CHECKING:
    # for typing, treat the super() chain as an Endpoint; runtime uses the real base via MRO
    from sentry.api.base import Endpoint

    _Base = Endpoint
else:
    _Base = object

CACHE_CONTROL = "private, no-cache"
METRIC_NAME = "api.conditional_get"
OPTION_NAME = "api.conditional_get.enabled"


def _if_none_match_matches(header: str | None, etag: str) -> bool:
    """Compare an If-None-Match header against our ETag, per RFC 9110.

    A proxy can send several validators, or downgrade ours to weak form.
    """
    if not header:
        return False
    candidates = parse_etags(header)
    if candidates == ["*"]:
        return True
    return any(candidate.removeprefix("W/") == etag for candidate in candidates)


class ConditionalGetResponseMixin(_Base):
    """Answers a repeated GET with 304 when the response body has not changed.

    Endpoints opt in by inheriting from this mixin. It belongs leftmost in the base
    class list, so it hashes the final payload. The ``api.conditional_get.enabled``
    option turns the behaviour off for every endpoint that uses it.
    """

    def finalize_response(
        self, request: Request, response: Response, *args: Any, **kwargs: Any
    ) -> Response:
        response = super().finalize_response(request, response, *args, **kwargs)

        if request.method not in ("GET", "HEAD") or response.status_code != 200:
            return response
        if not options.get(OPTION_NAME):
            return response
        if getattr(response, "accepted_renderer", None) is None:
            return response

        # render() marks the response rendered, so the body is encoded once.
        response.render()
        digest = hashlib.blake2b(response.content, digest_size=16).hexdigest()
        etag = f'"{digest}"'
        response["ETag"] = etag
        response["Cache-Control"] = CACHE_CONTROL
        patch_vary_headers(response, ("Cookie", "Authorization"))

        matched = _if_none_match_matches(request.META.get("HTTP_IF_NONE_MATCH"), etag)
        tags = {"result": "hit" if matched else "miss", "endpoint": type(self).__name__}
        metrics.incr(METRIC_NAME, tags=tags)
        # Sum this over result:hit for the bytes a 304 saved, and over result:miss
        # for the bytes still sent.
        metrics.distribution(
            f"{METRIC_NAME}.body_bytes", len(response.content), tags=tags, unit="byte"
        )
        if not matched:
            return response

        # Mutate in place: a new response object loses the CORS and deprecation headers.
        response.status_code = 304
        response.content = b""
        del response["Content-Type"]
        return response
