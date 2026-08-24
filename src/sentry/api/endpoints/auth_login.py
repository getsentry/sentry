from typing import TypedDict

from django.http import HttpRequest
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
from sentry.models.organization import Organization
from sentry.users.api.serializers.user import DetailedSelfUserSerializer
from sentry.users.models.authenticator import Authenticator
from sentry.utils import auth, metrics
from sentry.utils.hashlib import md5_text
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import OrganizationMixin, determine_active_organization


class AuthLoginRequest(TypedDict):
    username: str
    password: str


class AuthLoginRequestSerializer(CamelSnakeSerializer[AuthLoginRequest]):
    username = serializers.CharField(allow_blank=True)
    password = serializers.CharField(allow_blank=True, trim_whitespace=False)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthLoginEndpoint(Endpoint, OrganizationMixin):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    # Disable authentication and permission requirements.
    permission_classes = ()

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> Response:
        self.active_organization = determine_active_organization(request)
        return super().dispatch(request, *args, **kwargs)

    @extend_schema(
        operation_id="Log in with a username and password",
        request=AuthLoginRequestSerializer,
        responses={200: AuthSuccessSerializer, 202: AuthMfaRequiredSerializer},
    )
    def post(
        self, request: Request, organization: Organization | None = None, *args, **kwargs
    ) -> Response:
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

        login_completed = auth.login(
            request, user, organization_id=organization.id if organization else None
        )
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

        return Response(get_auth_success_payload(request, user))

    def respond_with_error(self, errors):
        return Response({"detail": "Login attempt failed", "errors": errors}, status=400)
