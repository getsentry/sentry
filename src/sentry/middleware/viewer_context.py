from __future__ import annotations

import logging
from collections.abc import Callable

from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.seer.agent_token import is_agent_auth
from sentry.viewer_context import (
    NO_VIEWER_ACTOR,
    ActorType,
    ViewerActor,
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

    Gated by ``viewer-context.enabled`` (FLAG_NOSTORE).
    """
    enabled = settings.SENTRY_VIEWER_CONTEXT_ENABLED

    def ViewerContextMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
            request.actor = NO_VIEWER_ACTOR
            return get_response(request)

        if not enabled:
            request.actor = _viewer_identity_from_request(request)[1] or NO_VIEWER_ACTOR
            return get_response(request)

        request_ctx = _viewer_context_from_request(request)
        jwt_ctx = _viewer_context_from_jwt_header(request)

        if jwt_ctx is not None and (
            request_ctx.actor is not None or request_ctx.user_id is not None
        ):
            # Direct user or agent authentication is authoritative when both are present.
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

        request.actor = ctx.actor or NO_VIEWER_ACTOR
        with viewer_context_scope(ctx):
            return get_response(request)

    return ViewerContextMiddleware_impl


def _viewer_context_from_jwt_header(request: HttpRequest) -> ViewerContext | None:
    header_value = request.META.get("HTTP_X_VIEWER_CONTEXT")
    if not header_value:
        return None
    return viewer_context_from_header(header_value)


def _viewer_identity_from_request(
    request: HttpRequest,
) -> tuple[ActorType, ViewerActor | None, int | None]:
    user = request.user
    auth = getattr(request, "auth", None)

    user_id: int | None = None
    if user.is_authenticated:
        user_id = user.id

    if auth is not None and is_agent_auth(auth):
        user_id = auth.user_id
        actor = (
            ViewerActor(type=ActorType.AGENT, id=auth.actor_id)
            if auth.actor_id is not None
            else None
        )
        return ActorType.AGENT, actor, user_id
    elif (
        auth is not None
        and getattr(auth, "actor_type", None) == ActorType.SERVICE_ACCOUNT.value
        and getattr(auth, "actor_id", None) is not None
    ):
        return (
            ActorType.SERVICE_ACCOUNT,
            ViewerActor(type=ActorType.SERVICE_ACCOUNT, id=auth.actor_id),
            None,
        )
    elif user_id is not None:
        return ActorType.USER, ViewerActor(type=ActorType.USER, id=user_id), user_id

    return ActorType.USER, None, user_id


def _viewer_context_from_request(request: HttpRequest) -> ViewerContext:
    auth = getattr(request, "auth", None)
    actor_type, actor, user_id = _viewer_identity_from_request(request)

    organization_id = getattr(auth, "organization_id", None)

    return ViewerContext(
        user_id=user_id,
        organization_id=organization_id,
        actor_type=actor_type,
        actor=actor,
        token=auth,
    )
