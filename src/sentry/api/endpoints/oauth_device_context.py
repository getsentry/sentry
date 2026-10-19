from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.oauth_device import (
    DEVICE_REQUEST_ERROR_STATUS,
    InvalidDeviceRequest,
    get_device_request,
)
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.oauth_consent import (
    OAuthRequestContextResponse,
    serialize_request_context,
)
from sentry.api.serializers.rest_framework.oauth_device import OAuthDeviceContextQuerySerializer
from sentry.models.apidevicecode import ApiDeviceCode
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class OAuthDeviceEntryResponse(TypedDict):
    stage: Literal["codeEntry"]


class OAuthDeviceContextResponse(OAuthRequestContextResponse):
    userCode: str


@dataclass(frozen=True, eq=False)
class OAuthDeviceContext:
    device: ApiDeviceCode | None


class OAuthDeviceContextSerializer(
    Serializer[OAuthDeviceContextResponse | OAuthDeviceEntryResponse]
):
    def serialize(
        self,
        obj: OAuthDeviceContext,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> OAuthDeviceContextResponse | OAuthDeviceEntryResponse:
        if obj.device is None:
            return {"stage": "codeEntry"}

        return {
            **serialize_request_context(obj.device.application, obj.device.get_scopes()),
            "userCode": obj.device.user_code,
        }


@extend_schema(tags=["Users"])
@control_silo_endpoint
@method_decorator(never_cache, name="dispatch")
class OAuthDeviceContextEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    authentication_classes = ()
    permission_classes = ()
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
        operation_id="Retrieve public OAuth device context",
        parameters=[OAuthDeviceContextQuerySerializer],
        responses={200: OAuthDeviceContextSerializer},
    )
    def get(self, request: Request) -> Response:
        """Describe a device request before sign-in, or return the code-entry state."""
        serializer = OAuthDeviceContextQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        user_code = serializer.validated_data["user_code"]
        device = (
            get_device_request(user_code, request.META.get("REMOTE_ADDR")) if user_code else None
        )
        return Response(
            serialize(OAuthDeviceContext(device), serializer=OAuthDeviceContextSerializer())
        )
