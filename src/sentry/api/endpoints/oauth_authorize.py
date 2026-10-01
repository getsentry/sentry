from __future__ import annotations

import logging
import re
import secrets
import time
from collections.abc import Mapping
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from django.contrib.sessions.backends.base import SessionBase
from django.db import IntegrityError, router, transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.oauth_consent import OAuthConsentEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_consent import (
    ConsentDecision,
    ConsentDecisionSerializer,
    OAuthConsentPermission,
    OAuthConsentResponse,
    OAuthRedirectResponse,
    serialize_consent,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger("sentry.oauth")

# RFC 7636 §4.2: code_challenge is 43-128 unreserved characters (same format as verifier)
# ABNF: code-challenge = 43*128unreserved
# unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
CODE_CHALLENGE_REGEX = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")

# How long an unused oa2:{tx_id} session entry is kept before pruning on the
# next GET. Abandoned tabs would otherwise accumulate until session expiry.
OAUTH_AUTHORIZE_SESSION_TTL = 10 * 60


def _expired_authorize_keys(session: SessionBase, now: float) -> list[str]:
    expired = []
    for key in list(session.keys()):
        if not key.startswith("oa2:"):
            continue
        entry = session.get(key)
        # The oa2: prefix is also used by oauth_device.py with a different
        # payload shape. Only touch entries carrying our "tx" marker.
        if not isinstance(entry, dict) or "tx" not in entry:
            continue
        ts = entry.get("ts")
        if not isinstance(ts, (int, float)) or now - ts > OAUTH_AUTHORIZE_SESSION_TTL:
            expired.append(key)
    return expired


class OAuthAuthorizeDecision(ConsentDecision):
    transaction_id: str


class OAuthAuthorizeDecisionSerializer(ConsentDecisionSerializer[OAuthAuthorizeDecision]):
    transaction_id = serializers.CharField(max_length=128)


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthAuthorizeEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OAuthConsentPermission,)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def _redirect_response(
        self,
        response_type: str | None,
        redirect_uri: str,
        params: Mapping[str, str | int | None],
    ) -> Response:
        if response_type == "token":
            final_uri = (
                f"{redirect_uri}#{urlencode([(k, v) for k, v in params.items() if v is not None])}"
            )
        else:
            parts = list(urlparse(redirect_uri))
            query = parse_qsl(parts[4])
            for key, value in params.items():
                if value is not None:
                    query.append((key, str(value)))
            parts[4] = urlencode(query)
            final_uri = urlunparse(parts)

        data: OAuthRedirectResponse = {"stage": "redirect", "redirectUrl": final_uri}
        return Response(data)

    def _error(
        self,
        response_type: str | None,
        redirect_uri: str | None,
        name: str,
        state: str | None = None,
        client_id: str | None = None,
        err_response: Literal["client_id", "redirect_uri"] | None = None,
    ) -> Response:
        logger.error(
            "oauth.authorize-error",
            extra={
                "error_name": name,
                "response_type": response_type,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
            },
        )
        if err_response:
            return Response({"detail": f"Missing or invalid {err_response} parameter."}, status=400)

        assert redirect_uri is not None
        return self._redirect_response(response_type, redirect_uri, {"error": name, "state": state})

    @extend_schema(
        operation_id="Retrieve OAuth authorization consent",
        parameters=[
            OpenApiParameter("client_id", str, required=True),
            OpenApiParameter("response_type", str, required=True, enum=["code", "token"]),
            OpenApiParameter("redirect_uri", str),
            OpenApiParameter("scope", str),
            OpenApiParameter("state", str),
            OpenApiParameter("force_prompt", str),
            OpenApiParameter("code_challenge", str),
            OpenApiParameter("code_challenge_method", str, enum=["S256"]),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OAuthAuthorizeContext",
                OAuthConsentResponse | OAuthRedirectResponse,
            )
        },
    )
    def get(self, request: Request) -> Response:
        assert request.user.is_authenticated

        response_type = request.GET.get("response_type")
        client_id = request.GET.get("client_id")
        redirect_uri = request.GET.get("redirect_uri")
        state = request.GET.get("state")
        force_prompt = request.GET.get("force_prompt")

        if not client_id:
            return self._error(
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self._error(
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        # Spec references:
        #   - RFC 6749 §3.1.2.3 (Redirection Endpoint): redirect_uri must match a pre-registered value; if
        #     multiple redirect URIs are registered, the client MUST include redirect_uri in the request.
        #     https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
        #   - RFC 8252 §8.4 (Native Apps): loopback redirect considerations (ephemeral ports).
        #     https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
        if not redirect_uri:
            # If multiple redirect URIs are registered, require the client to provide an
            # exact redirect_uri.
            # See RFC 6749 §3.1.2.3: https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
            uris = application.get_redirect_uris()
            if len(uris) != 1:
                return self._error(
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    err_response="redirect_uri",
                )
            redirect_uri = application.get_default_redirect_uri()
        elif not application.is_valid_redirect_uri(redirect_uri):
            return self._error(
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                err_response="redirect_uri",
            )

        # Canonicalize the callback URL so React navigates to the validated URI.  Without this, an attacker
        # could submit a non-canonical URI (e.g. with path traversal or extra
        # slashes) that normalizes to a registered URI for validation but
        # redirects to a raw, different-looking URL.
        redirect_uri = application.normalize_url(redirect_uri)

        # React navigates to these URLs directly. Apply the same scheme restrictions
        # as Django redirects, including the supported native application callbacks.
        if urlparse(redirect_uri).scheme not in (
            "",
            *HttpResponseRedirect.allowed_schemes,
            "sentry-apple",
            "sentry-replay-debugger",
        ):
            return self._error(
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                err_response="redirect_uri",
            )

        if not application.is_allowed_response_type(response_type):
            return self._error(
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unsupported_response_type",
                err_response="client_id",
            )

        scopes_s = request.GET.get("scope")
        if scopes_s:
            scopes = scopes_s.split(" ")
        else:
            scopes = []
        if application.requires_org_level_access:
            # Applications that require org level access have a maximum scope limit set
            # in admin that should not pass
            max_scopes = application.scopes
            for scope in scopes:
                if scope not in max_scopes:
                    return self._error(
                        client_id=client_id,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        name="invalid_scope",
                        state=state,
                    )

        for scope in scopes:
            if scope not in settings.SENTRY_SCOPES:
                return self._error(
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_scope",
                    state=state,
                )

        # PKCE support (RFC 7636): accept code_challenge and code_challenge_method.
        # This implementation only supports S256 method (plain method not supported for security).
        # Note: OAuth 2.1 requires S256 to be implemented; plain is still allowed in narrow cases.
        # Reference: https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
        code_challenge = request.GET.get("code_challenge")
        code_challenge_method = request.GET.get("code_challenge_method")

        if code_challenge is not None:
            # Validate code_challenge format per RFC 7636 §4.2: 43-128 unreserved chars
            if not CODE_CHALLENGE_REGEX.match(code_challenge):
                return self._error(
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            # Require S256 method explicitly (plain method not supported for security)
            if code_challenge_method != "S256":
                logger.error(
                    "oauth.pkce.invalid-method",
                    extra={
                        "client_id": client_id,
                        "application_id": application.id if application else None,
                        "method": code_challenge_method,
                    },
                )
                return self._error(
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

        # Generate a unique transaction ID per authorization request to prevent
        # session overwrite attacks. Without this, an attacker could open a malicious
        # OAuth flow in a popup/redirect, overwriting the legitimate app's session data.
        tx_id = secrets.token_urlsafe(32)
        now = time.time()
        # Prune stale authorize payloads from abandoned prior flows. The oa2:
        # prefix is shared with oauth_device.py, so only touch entries that
        # carry our "tx" marker.
        for stale_key in _expired_authorize_keys(request.session, now):
            request.session.pop(stale_key, None)
            request.session.modified = True
        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id,
            "cc": code_challenge,
            "ccm": code_challenge_method if code_challenge else None,
            "tx": tx_id,
            "ts": now,
        }
        session_key = f"oa2:{tx_id}"

        # If the application expects org level access, we need to prompt the user to choose which
        # organization they want to give access to every time. We should not presume the user intention
        if not (force_prompt or application.requires_org_level_access):
            try:
                existing_auth = ApiAuthorization.objects.get(
                    user_id=request.user.id, application=application
                )
            except ApiAuthorization.DoesNotExist:
                pass
            else:
                # if we've already approved all of the required scopes
                # we can skip prompting the user
                if all(existing_auth.has_scope(s) for s in scopes):
                    # Auto-approve returns a redirect immediately; no POST will
                    # follow, so don't persist the session entry.
                    return self._approve(
                        user=request.user,
                        application=application,
                        scopes=scopes,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        state=state,
                        code_challenge=payload.get("cc"),
                        code_challenge_method=payload.get("ccm"),
                    )

        permissions = []
        if scopes:
            pending_scopes = set(scopes)
            matched_sets = set()
            for scope_set in settings.SENTRY_SCOPE_SETS:
                for scope, description in scope_set:
                    if scope_set in matched_sets and scope in pending_scopes:
                        pending_scopes.remove(scope)
                    elif scope in pending_scopes:
                        permissions.append(description)
                        matched_sets.add(scope_set)
                        pending_scopes.remove(scope)

            if pending_scopes:
                raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

        if application.requires_org_level_access:
            organization_options = user_service.get_organizations(
                user_id=request.user.id, only_visible=True
            )
            if not organization_options:
                return Response(
                    {
                        "detail": "This authorization flow is only available for users who are members of an organization."
                    },
                    status=400,
                )
        else:
            # If application is not org level we should not show organizations to choose from at all
            organization_options = []

        # Only requests awaiting a consent decision need a session transaction.
        request.session[session_key] = payload
        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=application.id,
                response_type=response_type,
                outcome="viewed",
            )
        )
        return Response(
            serialize_consent(
                application=application,
                scopes=scopes,
                permissions=permissions,
                organization_options=organization_options,
                transaction_id=tx_id,
            )
        )

    @extend_schema(
        operation_id="Submit OAuth authorization consent",
        request=OAuthAuthorizeDecisionSerializer,
        responses={
            200: inline_sentry_response_serializer("OAuthConsentRedirect", OAuthRedirectResponse)
        },
    )
    def post(self, request: Request) -> Response:
        """Decide the transaction prepared by GET using its trusted session payload."""
        assert request.user.is_authenticated

        serializer = OAuthAuthorizeDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        op = data["op"]
        selected_organization_id = data["selected_organization_id"]
        tx_id = data["transaction_id"]

        session_key = f"oa2:{tx_id}"
        if session_key in _expired_authorize_keys(request.session, time.time()):
            request.session.pop(session_key, None)
            return Response(
                {"detail": "Your authorization request has expired. Please start over."}, status=400
            )

        try:
            payload = request.session[session_key]
        except KeyError:
            return Response(
                {
                    "detail": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
                status=400,
            )

        if payload.get("tx") != tx_id:
            return Response(
                {
                    "detail": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
                status=400,
            )

        try:
            application = ApiApplication.objects.get(
                client_id=payload["cid"], status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            # The app is gone; this payload can never succeed, so clear it to
            # avoid leaking a session entry on every replay of this error.
            request.session.pop(session_key, None)
            request.session.modified = True
            return Response({"detail": "Missing or invalid client_id parameter."}, status=400)

        # Consume each transaction once to prevent replay attacks.
        del request.session[session_key]
        request.session.modified = True

        if payload["uid"] != request.user.id:
            return Response(
                {
                    "detail": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
                status=400,
            )

        response_type = payload["rt"]
        redirect_uri = payload["ru"]
        scopes = payload["sc"]
        code_challenge = payload.get("cc")
        code_challenge_method = payload.get("ccm")

        if op == "approve":
            analytics.record(
                OAuthConsentEvent(
                    user_id=request.user.id,
                    application_id=application.id,
                    response_type=response_type,
                    outcome="approved",
                )
            )
            return self._approve(
                user=request.user,
                application=application,
                scopes=scopes,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=payload["st"],
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
                selected_organization_id=selected_organization_id,
            )

        analytics.record(
            OAuthConsentEvent(
                user_id=request.user.id,
                application_id=application.id,
                response_type=response_type,
                outcome="denied",
            )
        )
        return self._error(
            client_id=payload["cid"],
            response_type=response_type,
            redirect_uri=redirect_uri,
            name="access_denied",
            state=payload["st"],
        )

    def _approve(
        self,
        *,
        user: User,
        application: ApiApplication,
        scopes: list[str],
        response_type: Literal["code", "token"],
        redirect_uri: str,
        state: str | None,
        code_challenge: str | None = None,
        code_challenge_method: str | None = None,
        selected_organization_id: str | None = None,
    ) -> Response:
        # Organization-scoped applications require an explicit selection from
        # the user's visible memberships.
        if application.requires_org_level_access:
            if not selected_organization_id:
                return self._error(
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            user_orgs = user_service.get_organizations(user_id=user.id, only_visible=True)
            org_ids = {org.id for org in user_orgs}

            try:
                selected_org_id_int = int(selected_organization_id)
            except (ValueError, TypeError):
                return self._error(
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

            if selected_org_id_int not in org_ids:
                return self._error(
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

        if not application.requires_org_level_access:
            selected_organization_id = None

        try:
            with transaction.atomic(router.db_for_write(ApiAuthorization)):
                ApiAuthorization.objects.create(
                    application=application,
                    user_id=user.id,
                    scope_list=scopes,
                    organization_id=selected_organization_id,
                )
        except IntegrityError:
            if scopes:
                auth = ApiAuthorization.objects.get(
                    application=application,
                    user_id=user.id,
                    organization_id=selected_organization_id,
                )
                for scope in scopes:
                    if scope not in auth.scope_list:
                        auth.scope_list.append(scope)
                auth.save()

        metrics.incr(
            "oauth_authorize.get.approve",
            sample_rate=1.0,
            tags={
                "response_type": response_type,
            },
        )

        if response_type == "code":
            grant = ApiGrant.objects.create(
                user_id=user.id,
                application=application,
                redirect_uri=redirect_uri,
                scope_list=scopes,
                organization_id=selected_organization_id,
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
            )
            logger.info(
                "approve.grant",
                extra={
                    "response_type": response_type,
                    "redirect_uri": redirect_uri,
                    "scope": scopes,
                },
            )
            return self._redirect_response(
                response_type,
                redirect_uri,
                {"code": grant.code, "state": state},
            )
        elif response_type == "token":
            token = ApiToken.objects.create(
                application=application,
                user_id=user.id,
                refresh_token=None,
                scope_list=scopes,
                scoping_organization_id=selected_organization_id,
            )

            logger.info(
                "approve.token",
                extra={
                    "response_type": response_type,
                    "redirect_uri": redirect_uri,
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )
            assert token.expires_at, "expires_at is required"

            return self._redirect_response(
                response_type,
                redirect_uri,
                {
                    "access_token": token.token,
                    "expires_in": int((token.expires_at - timezone.now()).total_seconds()),
                    "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "token_type": "Bearer",
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )
        else:
            raise AssertionError(response_type)
