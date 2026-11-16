import logging
import re
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

from django.conf import settings
from django.http import HttpResponseRedirect

from sentry.api.helpers.oauth_authorize.response import (
    InvalidAuthorizationRequest,
    authorization_error,
)
from sentry.api.serializers.rest_framework.oauth_authorize import OAuthAuthorizeQuery
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus

logger = logging.getLogger("sentry.oauth")

# RFC 7636 §4.2: 43–128 unreserved characters.
CODE_CHALLENGE_REGEX = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")


@dataclass(frozen=True)
class AuthorizationRequest:
    application: ApiApplication
    response_type: Literal["code", "token"]
    redirect_uri: str
    scopes: list[str]
    state: str | None
    code_challenge: str | None
    code_challenge_method: Literal["S256"] | None


def get_active_application(client_id: str | None) -> ApiApplication:
    if client_id:
        try:
            return ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            pass

    raise InvalidAuthorizationRequest(
        "Missing or invalid client_id parameter.", parameter="client_id"
    )


def validate_redirect_uri(application: ApiApplication, redirect_uri: str | None) -> str:
    if not redirect_uri:
        # RFC 6749 §3.1.2.3 requires an explicit URI when multiple are registered.
        if len(application.get_redirect_uris()) != 1:
            raise InvalidAuthorizationRequest(
                "Missing or invalid redirect_uri parameter.", parameter="redirect_uri"
            )

        redirect_uri = application.get_default_redirect_uri()
    elif not application.is_valid_redirect_uri(redirect_uri):
        raise InvalidAuthorizationRequest(
            "Missing or invalid redirect_uri parameter.", parameter="redirect_uri"
        )

    # Navigate to the same canonical URI that was checked against registration.
    redirect_uri = application.normalize_url(redirect_uri)
    if urlparse(redirect_uri).scheme not in (
        "",
        *HttpResponseRedirect.allowed_schemes,
        "sentry-apple",
        "sentry-replay-debugger",
    ):
        raise InvalidAuthorizationRequest(
            "Missing or invalid redirect_uri parameter.", parameter="redirect_uri"
        )

    return redirect_uri


def build_authorization_request(params: OAuthAuthorizeQuery) -> AuthorizationRequest:
    application = get_active_application(params["client_id"])
    redirect_uri = validate_redirect_uri(application, params.get("redirect_uri"))
    response_type = params["response_type"]
    if not application.is_allowed_response_type(response_type):
        raise InvalidAuthorizationRequest(
            "Missing or invalid client_id parameter.", parameter="client_id"
        )

    assert response_type in ("code", "token")
    state = params.get("state")
    scope = params.get("scope")
    scopes = scope.split(" ") if scope else []
    if any(
        scope not in settings.SENTRY_SCOPES
        or (application.requires_org_level_access and scope not in application.scopes)
        for scope in scopes
    ):
        raise authorization_error(
            response_type=response_type,
            redirect_uri=redirect_uri,
            name="invalid_scope",
            state=state,
            client_id=application.client_id,
        )

    code_challenge = params.get("code_challenge")
    code_challenge_method = params.get("code_challenge_method")
    if code_challenge is not None:
        if not CODE_CHALLENGE_REGEX.match(code_challenge):
            raise authorization_error(
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                state=state,
                client_id=application.client_id,
            )

        if code_challenge_method != "S256":
            logger.error(
                "oauth.pkce.invalid-method",
                extra={
                    "client_id": application.client_id,
                    "application_id": application.id,
                    "method": code_challenge_method,
                },
            )
            raise authorization_error(
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                state=state,
                client_id=application.client_id,
            )

    return AuthorizationRequest(
        application=application,
        response_type=response_type,
        redirect_uri=redirect_uri,
        scopes=scopes,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256" if code_challenge else None,
    )
