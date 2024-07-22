from __future__ import annotations

from django.contrib.auth import get_user as auth_get_user
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from sentry.api.authentication import (
    ApiKeyAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.models.apitoken import ApiToken
from sentry.models.userip import UserIP
from sentry.organizations.services.organization import organization_service
from sentry.utils.auth import AuthUserPasswordExpired, logger


def get_user(request):
    if not hasattr(request, "_cached_user"):
        user = auth_get_user(request)
        # If the user bound to this request matches a real user,
        # we need to validate the session's nonce. This nonce is
        # to make sure that the session is valid for effectively the
        # current "version" of the user. When security related
        # actions take place, this nonce will rotate causing a
        # mismatch here forcing the session to be logged out and
        # requiring re-validation.
        if user.is_authenticated and not user.is_sentry_app:
            # We only need to check the nonce if there is a nonce
            # currently set on the User. By default, the value will
            # be None until the first action has been taken, at
            # which point, a nonce will always be required.
            if user.session_nonce and request.session.get("_nonce", "") != user.session_nonce:
                # If the nonces don't match, this session is anonymous.
                logger.info(
                    "user.auth.invalid-nonce",
                    extra={"ip_address": request.META["REMOTE_ADDR"], "user_id": user.id},
                )
                user = AnonymousUser()
            else:
                UserIP.log(user, request.META["REMOTE_ADDR"])
        request._cached_user = user
    return request._cached_user


class AuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request: HttpRequest) -> None:
        if request.path.startswith("/api/0/internal/rpc/"):
            # Avoid doing RPC authentication when we're already
            # in an RPC request.
            request.user = AnonymousUser()
            return

        auth = get_authorization_header(request).split()

        if auth:
            for authenticator_class in [
                UserAuthTokenAuthentication,
                OrgAuthTokenAuthentication,
                ApiKeyAuthentication,
            ]:
                authenticator = authenticator_class()
                if not authenticator.accepts_auth(auth):
                    continue
                try:
                    result = authenticator.authenticate(request)
                except AuthenticationFailed:
                    result = None
                if result:
                    request.user, request.auth = result
                else:
                    # default to anonymous user and use IP ratelimit
                    request.user = SimpleLazyObject(lambda: get_user(request))
                return

        # default to anonymous user and use IP ratelimit
        request.user = SimpleLazyObject(lambda: get_user(request))

    def process_exception(
        self, request: HttpRequest, exception: Exception
    ) -> HttpResponseBase | None:
        if isinstance(exception, AuthUserPasswordExpired):
            from sentry.web.frontend.accounts import expired

            return expired(request, exception.user)
        else:
            return None


class OrganizationScopedAuthenticationMiddleware(MiddlewareMixin):
    """Restricts cross-organization access for organization-scoped tokens."""

    def process_request(self, request: HttpRequest) -> None:
        # TODO: We only care about tokens authorization. Is this correct? Should we care about
        # more? I haven't restricted the org-application oauth flow yet to only produce tokens.
        # It can produce grants.
        if not hasattr(request, "auth") or not isinstance(
            request.auth, (ApiToken, ApiTokenReplica)
        ):
            return None

        # If the user's token does not allow them to access the organization we disable the
        # authorization set by "AuthenticationMiddleware".
        #
        # TODO: This is how the auth middleware handles it but should we raise an auth
        # exception or otherwise return a 401 response?
        if not can_access_organization(request, request.auth):
            request.auth = None
            request.user = SimpleLazyObject(lambda: get_user(request))


def can_access_organization(request: HttpRequest, token: ApiToken | ApiTokenReplica) -> bool:
    # Tokens which are not scoped are passed through.
    if not token.scoping_organization_id:
        return True

    # TODO
    # Resource is not scoped by any url params. Safe to ignore? Can the
    # organization be specified in the headers?
    if not request.resolver_match:
        return True

    # TODO
    # No org-id or slug in the urls params. Safe to ignore? Do any
    # resources query for organizations based on user membership?
    org_id_or_slug = request.resolver_match.kwargs.get("organization_id_or_slug")
    if org_id_or_slug is None:
        return True

    try:
        organization_id = int(org_id_or_slug)
    except ValueError:
        # TODO
        # Are we fetching this redudantly? Surely this query happens in
        # the endpoint. Should we cache it in some way?
        organization = organization_service.get_organization_by_slug(
            slug=str(org_id_or_slug),
            include_projects=False,
            include_teams=False,
        )
        if organization is None:
            return True

        organization_id = int(organization.id)

    return token.scoping_organization_id == organization_id
