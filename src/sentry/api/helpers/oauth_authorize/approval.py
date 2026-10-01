import logging

from django.db import IntegrityError, router, transaction
from django.utils import timezone

from sentry.api.helpers.oauth_authorize.request import AuthorizationRequest
from sentry.api.helpers.oauth_authorize.response import authorization_error, build_redirect_url
from sentry.models.apiapplication import ApiApplication
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

logger = logging.getLogger("sentry.oauth")


def resolve_organization(
    authorization: AuthorizationRequest, user_id: int, selected_organization_id: str | None
) -> int | None:
    if not authorization.application.requires_org_level_access:
        return None

    if not selected_organization_id:
        raise authorization_error(
            response_type=authorization.response_type,
            redirect_uri=authorization.redirect_uri,
            name="invalid_request",
            state=authorization.state,
            client_id=authorization.application.client_id,
        )

    organizations = user_service.get_organizations(user_id=user_id, only_visible=True)
    try:
        organization_id = int(selected_organization_id)
    except ValueError:
        organization_id = None

    if organization_id is None or organization_id not in {org.id for org in organizations}:
        raise authorization_error(
            response_type=authorization.response_type,
            redirect_uri=authorization.redirect_uri,
            name="unauthorized_client",
            state=authorization.state,
            client_id=authorization.application.client_id,
        )

    return organization_id


def persist_authorization(
    application: ApiApplication, user_id: int, scopes: list[str], organization_id: int | None
) -> None:
    # Catch outside the savepoint so an existing authorization can be updated
    # after PostgreSQL rolls back the conflicting insert.
    try:
        with transaction.atomic(router.db_for_write(ApiAuthorization)):
            ApiAuthorization.objects.create(
                application=application,
                user_id=user_id,
                scope_list=scopes,
                organization_id=organization_id,
            )
    except IntegrityError:
        if scopes:
            auth = ApiAuthorization.objects.get(
                application=application, user_id=user_id, organization_id=organization_id
            )
            auth.scope_list = list(dict.fromkeys([*auth.scope_list, *scopes]))
            auth.save()


def approve_authorization(
    authorization: AuthorizationRequest,
    user_id: int,
    selected_organization_id: str | None = None,
) -> str:
    organization_id = resolve_organization(authorization, user_id, selected_organization_id)
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
