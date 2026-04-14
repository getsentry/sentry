from __future__ import annotations

import logging
from collections.abc import Callable

from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    viewer_context_from_header,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)


def ViewerContextMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    """Set :class:`ViewerContext` for every request.

    Placed after ``AuthenticationMiddleware``. Authenticated user always
    takes precedence; ``X-Viewer-Context`` header is only used when
    there is no authenticated *user* (service-to-service calls that
    authenticate via HMAC but have no user session, e.g. Seer → Sentry).

    Accepts both JWT and legacy JSON + HMAC signature formats.

    Gated by ``viewer-context.enabled`` (FLAG_NOSTORE).
    """
    enabled = options.get("viewer-context.enabled")

    def ViewerContextMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        if not enabled:
            return get_response(request)

        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
            return get_response(request)

        request_ctx = _viewer_context_from_request(request)
        jwt_ctx = _viewer_context_from_jwt_header(request)

        if jwt_ctx is not None and request_ctx.user_id is not None:
            # Authenticated user takes precedence.
            if (
                jwt_ctx.organization_id is not None
                and request_ctx.organization_id is not None
                and jwt_ctx.organization_id != request_ctx.organization_id
            ):
                logger.error(
                    "viewer_context.jwt_request_mismatch",
                    extra={
                        "jwt_org_id": jwt_ctx.organization_id,
                        "request_org_id": request_ctx.organization_id,
                    },
                )
            ctx = request_ctx
        elif jwt_ctx is not None:
            ctx = jwt_ctx
        else:
            ctx = request_ctx

        with viewer_context_scope(ctx):
            return get_response(request)

    return ViewerContextMiddleware_impl


def _viewer_context_from_jwt_header(request: HttpRequest) -> ViewerContext | None:
    header_value = request.META.get("HTTP_X_VIEWER_CONTEXT")
    if not header_value:
        return None
    signature = request.META.get("HTTP_X_VIEWER_CONTEXT_SIGNATURE")
    return viewer_context_from_header(header_value, signature)


def _viewer_context_from_request(request: HttpRequest) -> ViewerContext:
    user = request.user
    auth = getattr(request, "auth", None)

    user_id: int | None = None
    if user.is_authenticated:
        user_id = user.id

    organization_id: int | None = None
    if auth is not None and hasattr(auth, "organization_id"):
        organization_id = auth.organization_id

    return ViewerContext(
        user_id=user_id,
        organization_id=organization_id,
        actor_type=ActorType.USER,
        token=auth,
    )
