from __future__ import annotations

from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope


def ViewerContextMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    """Set :class:`ViewerContext` for every request after authentication.

    Must be placed **after** ``AuthenticationMiddleware`` so that
    ``request.user`` and ``request.auth`` are already populated.

    Gated by the ``viewer-context.enabled`` option (FLAG_NOSTORE).
    Set via deploy config; requires restart to change.
    """
    enabled = options.get("viewer-context.enabled")

    def ViewerContextMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        if not enabled:
            return get_response(request)

        ctx = _viewer_context_from_request(request)
        with viewer_context_scope(ctx):
            return get_response(request)

    return ViewerContextMiddleware_impl


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
