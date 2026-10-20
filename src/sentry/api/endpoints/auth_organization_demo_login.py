from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.auth import get_auth_success_payload
from sentry.api.serializers.models.auth import (
    AuthMfaRequiredSerializer,
    AuthSuccessSerializer,
    serialize_auth_mfa_required,
)
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.demo_mode.utils import get_demo_user, is_demo_mode_enabled, is_demo_org
from sentry.organizations.services.organization import organization_service
from sentry.users.models.authenticator import Authenticator
from sentry.utils import auth
from sentry.web.frontend.base import determine_active_organization


class AuthDemoLoginRequest(TypedDict):
    next_uri: str | None


class AuthDemoLoginRequestSerializer(CamelSnakeSerializer[AuthDemoLoginRequest]):
    next_uri = serializers.CharField(allow_null=True, default=None, required=False)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthDemoLoginEndpoint(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()
    csrf_protect = True

    @extend_schema(
        operation_id="Log in to a demo organization",
        request=AuthDemoLoginRequestSerializer,
        responses={200: AuthSuccessSerializer, 202: AuthMfaRequiredSerializer},
    )
    def post(self, request: Request, organization_id_or_slug: str) -> Response:
        if not is_demo_mode_enabled():
            raise NotFound()

        serializer = AuthDemoLoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        organization_context = organization_service.get_organization_by_slug(
            slug=organization_id_or_slug,
            only_visible=True,
            include_projects=False,
            include_teams=False,
        )
        if organization_context is None or not is_demo_org(organization_context.organization):
            raise NotFound()

        organization = organization_context.organization
        user = get_demo_user()
        assert user is not None

        next_uri = serializer.validated_data["next_uri"]
        if next_uri and auth.is_valid_redirect(next_uri, allowed_hosts=(request.get_host(),)):
            request.session["_next"] = next_uri

        login_completed = auth.login(request, user, organization_id=organization.id)
        if not login_completed:
            interfaces = Authenticator.objects.all_interfaces_for_user(user)
            return Response(
                serialize_auth_mfa_required(
                    user, [interface.interface_id for interface in interfaces]
                ),
                status=202,
            )

        determine_active_organization(request, organization.slug)
        return Response(get_auth_success_payload(request, user))
