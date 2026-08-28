import logging

from django.urls import reverse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.auth import (
    AuthOrganizationConfig,
    AuthOrganizationConfigSerializer,
)
from sentry.auth import access
from sentry.auth.exceptions import ProviderNotRegistered
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.demo_mode.utils import is_demo_mode_enabled, is_demo_org
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationavatarreplica import OrganizationAvatarReplica
from sentry.organizations.services.organization import organization_service
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.auth import construct_link_with_query, has_completed_sso, has_user_registration

logger = logging.getLogger(__name__)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthOrganizationConfigEndpoint(Endpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)},
        }
    )

    @extend_schema(
        operation_id="Retrieve organization login configuration",
        responses={200: AuthOrganizationConfigSerializer},
    )
    def get(self, request: Request, organization_id_or_slug: str) -> Response:
        organization_context = organization_service.get_organization_by_slug(
            slug=organization_id_or_slug,
            only_visible=True,
            user_id=request.user.id if request.user.is_authenticated else None,
            include_projects=False,
            include_teams=False,
        )
        if organization_context is None:
            raise NotFound()

        organization = organization_context.organization
        auth_provider = AuthProvider.objects.filter(organization_id=organization.id).first()
        avatar = OrganizationAvatarReplica.objects.filter(organization_id=organization.id).first()

        provider = None
        if auth_provider is not None:
            try:
                provider = auth_provider.get_provider()
            except ProviderNotRegistered:
                logger.exception(
                    "auth.organization_config.provider_not_registered",
                    extra={"organization_id": organization.id, "provider": auth_provider.provider},
                )
                return Response(
                    {"detail": "Organization authentication is temporarily unavailable"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        organization_access = access.from_request_org_and_scopes(
            request=request, rpc_user_org_context=organization_context
        )
        member_authenticated = bool(
            request.user.is_authenticated
            and organization_access.has_scope("org:read")
            and (
                not organization_access.requires_sso
                or (
                    organization_access.sso_is_valid and has_completed_sso(request, organization.id)
                )
            )
        )
        join_request_url = None
        if auth_provider is None and organization.get_option("sentry:join_requests") is not False:
            join_request_url = construct_link_with_query(
                path=reverse("sentry-join-request", args=[organization.slug]),
                query_params=request.GET,
            )

        warnings = []
        if (
            request.user.is_authenticated
            and organization_context.member is None
            and not organization_access.has_global_access
            and not (is_demo_mode_enabled() and is_demo_org(organization))
        ):
            warnings.append(
                f"Your account ({request.user.email}) is not a member of the "
                f"{organization.name} organization. Ask an organization admin to "
                "invite you, or sign in with a different account."
            )

        session_expired = "session_expired" in request.COOKIES
        if session_expired:
            warnings.append(str(WARN_SESSION_EXPIRED))

        auth_org_config = AuthOrganizationConfig(
            authenticated=request.user.is_authenticated,
            member_authenticated=member_authenticated,
            can_register=bool(has_user_registration() or request.session.get("can_register")),
            join_request_url=join_request_url,
            login_method="sso" if provider is not None else "password",
            sso_required=bool(auth_provider is not None and not auth_provider.flags.allow_unlinked),
            organization={
                "avatarUrl": (
                    avatar.absolute_url()
                    if avatar is not None and avatar.avatar_type == 1
                    else None
                ),
                "name": organization.name,
                "slug": organization.slug,
            },
            provider={"key": provider.key, "name": provider.name} if provider else None,
            warnings=warnings,
        )
        response = Response(
            serialize(auth_org_config, request.user, AuthOrganizationConfigSerializer()),
            status=status.HTTP_200_OK,
        )
        if session_expired:
            response.delete_cookie("session_expired")

        return response
