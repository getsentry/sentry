from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_consent import (
    InvalidOrganizationSelection,
    get_organization_options,
)
from sentry.api.helpers.oauth_device import (
    DEVICE_REQUEST_ERROR_STATUS,
    InvalidDeviceRequest,
    complete_device_request,
    get_device_request,
    get_prepared_device_request,
    prepare_device_consent,
)
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryIsAuthenticated
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.organization import (
    ControlSiloOrganizationSerializer,
    ControlSiloOrganizationSerializerResponse,
)
from sentry.api.serializers.rest_framework.oauth_consent import (
    ConsentDecision,
    ConsentDecisionSerializer,
)
from sentry.api.serializers.rest_framework.oauth_device import (
    OAuthDeviceQuerySerializer,
    OAuthUserCodeField,
)
from sentry.auth.email import emails_match
from sentry.hybridcloud.services.organization_mapping.model import RpcOrganizationMapping
from sentry.models.apidevicecode import ApiDeviceCode
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


class OAuthDeviceDecision(ConsentDecision):
    user_code: str


class OAuthDeviceDecisionSerializer(ConsentDecisionSerializer[OAuthDeviceDecision]):
    user_code = OAuthUserCodeField(
        help_text="The user code returned by device consent preparation."
    )


class OAuthDeviceCompleteResponse(TypedDict):
    stage: Literal["approved", "denied"]


@dataclass(frozen=True, eq=False)
class OAuthDeviceComplete:
    status: Literal["approved", "denied"]


class OAuthDeviceCompleteSerializer(Serializer[OAuthDeviceCompleteResponse]):
    def serialize(
        self,
        obj: OAuthDeviceComplete,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthDeviceCompleteResponse:
        return {"stage": obj.status}


def ensure_expected_account(device: ApiDeviceCode, user: User) -> None:
    # The device asked for a specific account, so approving as anyone else would
    # issue a token the device did not expect.
    if device.login_hint is not None and not emails_match(device.login_hint, user.email):
        raise PermissionDenied(
            f"This request is for {device.login_hint}. Sign in as that account to continue."
        )


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthDeviceEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
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
        ensure_expected_account(device, request.user)
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

    @extend_schema(
        operation_id="Submit OAuth device consent",
        request=OAuthDeviceDecisionSerializer,
        responses={200: OAuthDeviceCompleteSerializer},
    )
    def post(self, request: AuthenticatedHttpRequest) -> Response:
        """Complete the prepared device request with explicit approval or denial."""
        serializer = OAuthDeviceDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data
        device = get_prepared_device_request(
            request.session, decision["user_code"], request.user.id
        )
        ensure_expected_account(device, request.user)
        try:
            status = complete_device_request(
                device.id, request.user.id, decision["op"], decision["selected_organization_id"]
            )
        except InvalidOrganizationSelection as exc:
            raise ValidationError({"selectedOrganizationId": exc.public_message}) from exc

        request.session.pop(f"oa2:{device.user_code}", None)
        return Response(
            serialize(OAuthDeviceComplete(status), serializer=OAuthDeviceCompleteSerializer())
        )
