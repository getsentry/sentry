from typing import NotRequired, TypedDict

import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.helpers.auth import get_auth_success_payload
from sentry.api.serializers.models.auth import (
    AuthDetailSerializer,
    AuthMfaChallengeSerializer,
    AuthMfaRequiredSerializer,
    AuthSuccessSerializer,
    serialize_activation,
    serialize_auth_mfa_required,
)
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.auth.authenticators.base import (
    ActivationChallengeResult,
    ActivationMessageResult,
    ActivationRateLimited,
    AuthenticatorInterface,
)
from sentry.auth.twofactor import is_2fa_rate_limited, send_2fa_rate_limit_notification
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.user import User
from sentry.utils import auth


class AuthWebAuthnResponse(TypedDict):
    key_handle: str
    client_data: str
    authenticator_data: str
    signature_data: str


class AuthTwoFactorRequest(TypedDict):
    method: str
    otp: NotRequired[str]
    response: NotRequired[AuthWebAuthnResponse]


class AuthWebAuthnResponseSerializer(CamelSnakeSerializer[AuthWebAuthnResponse]):
    key_handle = serializers.CharField()
    client_data = serializers.CharField()
    authenticator_data = serializers.CharField()
    signature_data = serializers.CharField()


class AuthTwoFactorRequestSerializer(CamelSnakeSerializer[AuthTwoFactorRequest]):
    method = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=20, required=False, trim_whitespace=False)
    response = AuthWebAuthnResponseSerializer(required=False)

    def validate(self, attrs: AuthTwoFactorRequest) -> AuthTwoFactorRequest:
        has_otp = "otp" in attrs
        has_response = "response" in attrs
        if has_otp == has_response:
            raise serializers.ValidationError("Provide either an OTP or a challenge response.")
        return attrs


class AuthTwoFactorChallengeRequest(TypedDict):
    method: str


class AuthTwoFactorChallengeRequestSerializer(CamelSnakeSerializer[AuthTwoFactorChallengeRequest]):
    method = serializers.CharField(max_length=20)


def get_pending_interface(
    request: Request, method: str
) -> tuple[User | None, AuthenticatorInterface | None]:
    user = auth.get_pending_2fa_user(request)
    if user is None:
        return None, None

    interfaces = Authenticator.objects.all_interfaces_for_user(user)
    interface = next(
        (interface for interface in interfaces if interface.interface_id == method), None
    )
    return user, interface


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthTwoFactorEndpoint(Endpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()

    @extend_schema(
        operation_id="Get available methods for a pending two-factor authentication login",
        responses={200: AuthMfaRequiredSerializer},
    )
    def get(self, request: Request) -> Response:
        user = auth.get_pending_2fa_user(request)
        if user is None:
            return Response(
                {"detail": "No two-factor authentication request is active"}, status=404
            )

        interfaces = Authenticator.objects.all_interfaces_for_user(user)
        return Response(
            serialize_auth_mfa_required(user, [interface.interface_id for interface in interfaces])
        )

    @extend_schema(
        operation_id="Complete a pending two-factor authentication login",
        request=AuthTwoFactorRequestSerializer,
        responses={200: AuthSuccessSerializer, 403: AuthDetailSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = AuthTwoFactorRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, interface = get_pending_interface(request, serializer.validated_data["method"])
        if user is None:
            return Response({"detail": "No pending two-factor authentication"}, status=401)
        if interface is None:
            return Response({"detail": "Unsupported two-factor authentication method"}, status=400)

        if is_2fa_rate_limited(user.id):
            send_2fa_rate_limit_notification(
                user_id=user.id,
                email=user.username,
                ip_address=request.META["REMOTE_ADDR"],
            )
            return Response(
                {"detail": "Too many two-factor authentication attempts"},
                status=429,
            )

        if "otp" in serializer.validated_data:
            if not interface.can_validate_otp:
                return Response(
                    {"detail": "Unsupported two-factor authentication method"}, status=400
                )
            is_valid = interface.validate_otp(serializer.validated_data["otp"])
        elif "response" in serializer.validated_data:
            response = serializer.validated_data["response"]
            try:
                is_valid = interface.validate_response(
                    request,
                    None,
                    {
                        "keyHandle": response["key_handle"],
                        "clientData": response["client_data"],
                        "authenticatorData": response["authenticator_data"],
                        "signatureData": response["signature_data"],
                    },
                )
            except ValueError:
                is_valid = False
        else:
            is_valid = False

        if not is_valid:
            return Response({"detail": "Invalid two-factor authentication credentials"}, status=400)

        try:
            is_authenticated = auth.login(request, user, passed_2fa=True)
        except auth.AuthUserPasswordExpired:
            request.session.pop(auth.MFA_SESSION_KEY, None)
            return Response(
                {"detail": "Cannot complete authentication because the password has expired"},
                status=403,
            )

        if not is_authenticated:
            return Response({"detail": "Unable to complete authentication"}, status=400)

        assert interface.authenticator is not None
        interface.authenticator.mark_used()

        return Response(get_auth_success_payload(request, user))

    @extend_schema(
        operation_id="Cancel a pending two-factor authentication login",
        responses={204: None},
    )
    def delete(self, request: Request) -> Response:
        request.session.pop("_pending_2fa", None)
        request.session.pop("_after_2fa", None)
        request.session.pop("webauthn_authentication_state", None)
        return Response(status=204)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthTwoFactorChallengeEndpoint(Endpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()

    @extend_schema(
        operation_id="Activate a two-factor authentication challenge",
        request=AuthTwoFactorChallengeRequestSerializer,
        responses={200: AuthMfaChallengeSerializer},
    )
    def post(self, request: Request) -> Response:
        serializer = AuthTwoFactorChallengeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, interface = get_pending_interface(request, serializer.validated_data["method"])
        if user is None:
            return Response({"detail": "No pending two-factor authentication"}, status=401)

        if interface is None or not interface.requires_activation:
            return Response(
                {"detail": "Authentication method does not require a challenge"}, status=400
            )

        try:
            activation = interface.activate(request)
        except ActivationRateLimited:
            return Response(
                {"detail": "Too many authentication challenge attempts"},
                status=429,
            )

        if isinstance(activation, ActivationMessageResult) and activation.type == "error":
            sentry_sdk.capture_message(
                "Two-factor authentication challenge activation failed",
                level="error",
                extras={"method": interface.interface_id},
            )
            return Response({"detail": "Unable to activate authentication challenge"}, status=503)
        if not isinstance(activation, (ActivationChallengeResult, ActivationMessageResult)):
            sentry_sdk.capture_message(
                "Unexpected two-factor authentication challenge activation result",
                level="error",
                extras={
                    "activation_type": type(activation).__name__,
                    "method": interface.interface_id,
                },
            )
            return Response({"detail": "Unable to activate authentication challenge"}, status=500)

        try:
            response = serialize_activation(interface.interface_id, activation, user)
        except ValueError as error:
            sentry_sdk.capture_exception(error)
            return Response({"detail": "Unable to activate authentication challenge"}, status=500)
        return Response(response)
