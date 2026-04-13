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
    decode_viewer_context,
    is_jwt_viewer_context,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)


def ViewerContextMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    """Set :class:`ViewerContext` for every request after authentication.

    Must be placed **after** ``AuthenticationMiddleware`` so that
    ``request.user`` and ``request.auth`` are already populated.

    If the request carries a valid ``X-Viewer-Context`` JWT header,
    the context is restored from the token instead of the Django auth
    user.  This is the path used by service-to-service calls (e.g.
    Seer calling back into Sentry).

    Gated by the ``viewer-context.enabled`` option (FLAG_NOSTORE).
    Set via deploy config; requires restart to change.
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
        jwt_ctx = _viewer_context_from_jwt(request)

        if jwt_ctx is not None and request_ctx.user_id is not None:
            # Authenticated user takes precedence. Log if the JWT disagrees.
            if (
                jwt_ctx.organization_id is not None
                and request_ctx.organization_id is not None
                and jwt_ctx.organization_id != request_ctx.organization_id
            ):
                logger.warning(
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


def _viewer_context_from_jwt(request: HttpRequest) -> ViewerContext | None:
    """Try to extract a ViewerContext from the X-Viewer-Context JWT header.

    Returns ``None`` if the header is absent, not a JWT, or fails
    verification.
    """
    header_value = request.META.get("HTTP_X_VIEWER_CONTEXT")
    if not header_value:
        return None

    if not is_jwt_viewer_context(header_value):
        return None

    try:
        return decode_viewer_context(header_value)
    except Exception:
        logger.warning("viewer_context.jwt_decode_failed", exc_info=True)
        return None


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
