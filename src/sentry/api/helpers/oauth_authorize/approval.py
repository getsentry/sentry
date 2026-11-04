import logging

from django.utils import timezone

from sentry.api.helpers.oauth_authorize.request import AuthorizationRequest
from sentry.api.helpers.oauth_authorize.response import authorization_error, build_redirect_url
from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    OrganizationSelectionError,
    persist_authorization,
    resolve_organization,
)
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.utils import metrics

logger = logging.getLogger("sentry.oauth")

ORGANIZATION_SELECTION_OAUTH_ERRORS = {
    OrganizationSelectionError.REQUIRED: "invalid_request",
    OrganizationSelectionError.INVALID: "unauthorized_client",
    OrganizationSelectionError.NOT_ACCESSIBLE: "unauthorized_client",
}


def approve_authorization(
    authorization: AuthorizationRequest,
    user_id: int,
    selected_organization_id: str | None = None,
) -> str:
    try:
        organization_id = resolve_organization(
            authorization.application, user_id, selected_organization_id
        )
    except InvalidOrganizationSelection as exc:
        raise authorization_error(
            response_type=authorization.response_type,
            redirect_uri=authorization.redirect_uri,
            name=ORGANIZATION_SELECTION_OAUTH_ERRORS[exc.reason],
            state=authorization.state,
            client_id=authorization.application.client_id,
        ) from exc
    persist_authorization(authorization.application, user_id, authorization.scopes, organization_id)
    metrics.incr(
        "oauth_authorize.get.approve",
        sample_rate=1.0,
        tags={"response_type": authorization.response_type},
    )

    if authorization.response_type == "code":
        return issue_authorization_code(authorization, user_id, organization_id)

    return issue_implicit_token(authorization, user_id, organization_id)


def issue_authorization_code(
    authorization: AuthorizationRequest, user_id: int, organization_id: int | None
) -> str:
    grant = ApiGrant.objects.create(
        user_id=user_id,
        application=authorization.application,
        redirect_uri=authorization.redirect_uri,
        scope_list=authorization.scopes,
        organization_id=organization_id,
        code_challenge=authorization.code_challenge,
        code_challenge_method=authorization.code_challenge_method,
    )
    logger.info(
        "approve.grant",
        extra={
            "response_type": authorization.response_type,
            "redirect_uri": authorization.redirect_uri,
            "scope": authorization.scopes,
        },
    )
    return build_redirect_url(
        authorization.response_type,
        authorization.redirect_uri,
        {"code": grant.code, "state": authorization.state},
    )


def issue_implicit_token(
    authorization: AuthorizationRequest, user_id: int, organization_id: int | None
) -> str:
    token = ApiToken.objects.create(
        application=authorization.application,
        user_id=user_id,
        refresh_token=None,
        scope_list=authorization.scopes,
        scoping_organization_id=organization_id,
    )
    logger.info(
        "approve.token",
        extra={
            "response_type": authorization.response_type,
            "redirect_uri": authorization.redirect_uri,
            "scope": " ".join(token.get_scopes()),
            "state": authorization.state,
        },
    )
    assert token.expires_at, "expires_at is required"

    return build_redirect_url(
        authorization.response_type,
        authorization.redirect_uri,
        {
            "access_token": token.token,
            "expires_in": int((token.expires_at - timezone.now()).total_seconds()),
            "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "token_type": "Bearer",
            "scope": " ".join(token.get_scopes()),
            "state": authorization.state,
        },
    )
