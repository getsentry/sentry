from django.conf import settings

from sentry.api.helpers.oauth_authorize.request import AuthorizationRequest
from sentry.api.helpers.oauth_authorize.response import InvalidAuthorizationRequest
from sentry.api.helpers.oauth_consent import OAuthConsentResponse, serialize_consent
from sentry.models.apiauthorization import ApiAuthorization
from sentry.users.services.user.service import user_service


def has_existing_consent(authorization: AuthorizationRequest, user_id: int) -> bool:
    # Organization access always needs an explicit choice of organization.
    if authorization.application.requires_org_level_access:
        return False

    try:
        existing = ApiAuthorization.objects.get(
            user_id=user_id, application=authorization.application
        )
    except ApiAuthorization.DoesNotExist:
        return False

    return all(existing.has_scope(scope) for scope in authorization.scopes)


def get_permission_descriptions(scopes: list[str]) -> list[str]:
    permissions = []
    pending_scopes = set(scopes)
    for scope_set in settings.SENTRY_SCOPE_SETS:
        matched = [description for scope, description in scope_set if scope in pending_scopes]
        if matched:
            permissions.append(matched[0])
            pending_scopes.difference_update(scope for scope, _ in scope_set)

    if pending_scopes:
        raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

    return permissions


def get_consent_context(authorization: AuthorizationRequest, user_id: int) -> OAuthConsentResponse:
    permissions = get_permission_descriptions(authorization.scopes)
    organization_options = []
    if authorization.application.requires_org_level_access:
        organization_options = user_service.get_organizations(user_id=user_id, only_visible=True)
        if not organization_options:
            raise InvalidAuthorizationRequest(
                "This authorization flow is only available for users who are members of an organization."
            )

    return serialize_consent(
        application=authorization.application,
        scopes=authorization.scopes,
        permissions=permissions,
        organization_options=organization_options,
    )
