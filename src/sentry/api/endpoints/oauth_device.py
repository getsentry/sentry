from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_consent import (
    get_organization_options,
)
from sentry.api.helpers.oauth_device import (
    DEVICE_REQUEST_ERROR_STATUS,
    InvalidDeviceRequest,
    get_device_request,
    prepare_device_consent,
)
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.organization import (
    ControlSiloOrganizationSerializer,
    ControlSiloOrganizationSerializerResponse,
)
from sentry.api.serializers.rest_framework.oauth_device import (
    OAuthDeviceQuerySerializer,
)
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.auth import AuthenticatedHttpRequest


class OAuthDeviceConsentResponse(TypedDict):
    stage: Literal["consent"]
    userCode: str
    organizationOptions: list[ControlSiloOrganizationSerializerResponse]


@dataclass(frozen=True, eq=False)
class OAuthDeviceConsent:
    user_code: str
    organizations: Sequence[RpcOrganizationMapping]


class OAuthDeviceConsentSerializer(Serializer[OAuthDeviceConsentResponse]):
    def serialize(
        self,
        obj: OAuthDeviceConsent,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthDeviceConsentResponse:
        return {
            "stage": "consent",
            "userCode": obj.user_code,
            "organizationOptions": serialize(
                obj.organizations, serializer=ControlSiloOrganizationSerializer()
            ),
        }


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthDeviceEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (SentryIsAuthenticated, DisallowImpersonatedTokenCreation)
    csrf_protect = True
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    def handle_exception(self, exc: Exception) -> Response:
        if isinstance(exc, InvalidDeviceRequest):
            return Response(
                {"detail": exc.public_message}, status=DEVICE_REQUEST_ERROR_STATUS[exc.code]
            )

        return super().handle_exception(exc)

    @extend_schema(
        operation_id="Prepare OAuth device consent",
        parameters=[OAuthDeviceQuerySerializer],
        responses={200: OAuthDeviceConsentSerializer},
    )
    def get(self, request: AuthenticatedHttpRequest) -> Response:
        """Bind a pending device request to the signed-in account for explicit consent."""
        serializer = OAuthDeviceQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        device = get_device_request(
            serializer.validated_data["user_code"], request.META.get("REMOTE_ADDR")
        )
        organizations = get_organization_options(device.application, request.user.id)
        if device.application.requires_org_level_access and not organizations:
            raise ValidationError(
                {
                    "detail": "This application requires organization-level access. "
                    "You must be a member of an organization to authorize this application."
                }
            )

        prepare_device_consent(request.session, device, request.user.id)
        return Response(
            serialize(
                OAuthDeviceConsent(device.user_code, organizations),
                serializer=OAuthDeviceConsentSerializer(),
            )
        )
