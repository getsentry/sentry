from typing import TypedDict

from django.http import HttpRequest
from django.urls import reverse
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits as ratelimiter
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.auth import get_auth_success_payload
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.auth import (
    AuthMfaRequiredSerializer,
    AuthSuccessSerializer,
    serialize_auth_mfa_required,
)
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.services.access.service import access_service
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import RpcOrganizationMemberSummary
from sentry.users.api.serializers.user import DetailedSelfUserSerializer
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import auth, metrics
from sentry.utils.hashlib import md5_text
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import OrganizationMixin, determine_active_organization


class AuthLoginRequest(TypedDict):
    username: str
    password: str
    org_slug: str | None


class AuthLoginRequestSerializer(CamelSnakeSerializer[AuthLoginRequest]):
    username = serializers.CharField(allow_blank=True)
    password = serializers.CharField(allow_blank=True, trim_whitespace=False)
    org_slug = serializers.CharField(allow_null=True, default=None, required=False)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthLoginEndpoint(Endpoint, OrganizationMixin):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    # Disable authentication and permission requirements.
    permission_classes = ()

    def get_password_organization(
        self,
        user: User,
        requested_slug: str | None,
        organization_mappings: list[RpcOrganizationMapping],
    ) -> RpcOrganizationMapping | None:
        """Choose a destination that does not require an SSO-authenticated session.

        The requested slug controls navigation only. Password authentication must never
        satisfy an organization's SSO requirement.
        """
        ordered_mappings = sorted(
            organization_mappings,
            key=lambda mapping: mapping.slug != requested_slug,
        )
        member_mappings = {
            mapping.organization_id: mapping
            for mapping in OrganizationMemberMapping.objects.filter(
                organization_id__in=[mapping.id for mapping in ordered_mappings],
                user_id=user.id,
            )
        }

        for mapping in ordered_mappings:
            member_mapping = member_mappings.get(mapping.id)
            if member_mapping is None or member_mapping.organizationmember_id is None:
                continue

            auth_state = access_service.get_user_auth_state(
                user_id=user.id,
                organization_id=mapping.id,
                is_superuser=user.is_superuser,
                is_staff=user.is_staff,
                org_member=RpcOrganizationMemberSummary(
                    id=member_mapping.organizationmember_id,
                    organization_id=member_mapping.organization_id,
                    user_id=member_mapping.user_id,
                ),
            )
            if not auth_state.sso_state.is_required:
                return mapping

        return None

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> Response:
        self.active_organization = determine_active_organization(request)
        return super().dispatch(request, *args, **kwargs)

    @extend_schema(
        operation_id="Log in with a username and password",
        request=AuthLoginRequestSerializer,
        responses={200: AuthSuccessSerializer, 202: AuthMfaRequiredSerializer},
    )
    def post(self, request: Request, *args, **kwargs) -> Response:
        """
        Process a login request via username/password. SSO login is handled
        elsewhere.
        """
        serializer = AuthLoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login_form = AuthenticationForm(request, serializer.validated_data)

        # Rate limit logins
        is_limited = ratelimiter.backend.is_limited(
            "auth:login:username:{}".format(
                md5_text(
                    login_form.clean_username(serializer.validated_data.get("username"))
                ).hexdigest()
            ),
            limit=10,
            window=60,  # 10 per minute should be enough for anyone
        )

        if is_limited:
            errors = {"__all__": [login_form.error_messages["rate_limited"]]}
            metrics.incr(
                "login.attempt", instance="rate_limited", skip_internal=True, sample_rate=1.0
            )

            return self.respond_with_error(errors)

        if not login_form.is_valid():
            metrics.incr("login.attempt", instance="failure", skip_internal=True, sample_rate=1.0)
            return self.respond_with_error(login_form.errors)

        user = login_form.get_user()

        if getattr(user, "is_suspended", False):
            metrics.incr("login.attempt", instance="failure", skip_internal=True, sample_rate=1.0)
            auth.record_suspended_user_rejection("api_login")
            return self.respond_with_error({"__all__": ["Your account has been suspended."]})

        org_slug = serializer.validated_data["org_slug"]
        organizations = user_service.get_organizations(user_id=user.id, only_visible=True)
        organization = self.get_password_organization(user, org_slug, organizations)
        if organization:
            auth.set_active_org(request, organization.slug)
        else:
            # An SSO-only membership still authenticates the user account. Keep the
            # organization out of session context so it cannot be mistaken for SSO access.
            auth.clear_active_org(request)
            if organizations:
                request.session["_next"] = reverse("sentry-account-settings")

        login_completed = auth.login(request, user)
        metrics.incr("login.attempt", instance="success", skip_internal=True, sample_rate=1.0)

        if not user.is_active:
            return Response(
                {
                    "nextUri": "/auth/reactivate/",
                    "user": serialize(user, user, DetailedSelfUserSerializer()),
                }
            )

        if not login_completed:
            interfaces = Authenticator.objects.all_interfaces_for_user(user)

            return Response(
                serialize_auth_mfa_required(
                    user, [interface.interface_id for interface in interfaces]
                ),
                status=202,
            )

        payload = get_auth_success_payload(request, user)
        if organization is None and organizations:
            # Payload generation resolves a default membership after login. Remove that
            # fallback when every membership requires SSO.
            auth.clear_active_org(request)

        return Response(payload)

    def respond_with_error(self, errors):
        return Response({"detail": "Login attempt failed", "errors": errors}, status=400)
