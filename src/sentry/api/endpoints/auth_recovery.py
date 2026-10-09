from typing import TypedDict

from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import router, transaction
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
    AuthRecoveryAccepted,
    AuthRecoveryAcceptedSerializer,
)
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.auth import password_validation
from sentry.auth.twofactor import reset_2fa_rate_limits
from sentry.security.utils import capture_security_activity
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import auth
from sentry.utils.auth import find_users


class AuthRecoveryRequest(TypedDict):
    user: str


class AuthRecoveryRequestSerializer(CamelSnakeSerializer[AuthRecoveryRequest]):
    user = serializers.CharField(max_length=128)


class AuthRecoveryTokenRequest(TypedDict):
    user_id: int
    token: str


class AuthRecoveryConfirmRequest(AuthRecoveryTokenRequest):
    password: str


class AuthRecoveryConfirmRequestSerializer(CamelSnakeSerializer[AuthRecoveryConfirmRequest]):
    user_id = serializers.IntegerField(min_value=1)
    token = serializers.CharField(max_length=64)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


class AuthRecoveryTokenRequestSerializer(CamelSnakeSerializer[AuthRecoveryTokenRequest]):
    user_id = serializers.IntegerField(min_value=1)
    token = serializers.CharField(max_length=64)


class AuthRecoveryTokenResponse(TypedDict):
    valid: bool


class AuthPasswordAssignmentResponse(TypedDict):
    nextUri: str


class AuthPasswordAssignmentResponseSerializer(serializers.Serializer):
    nextUri = serializers.CharField()


class AuthRecoveryTokenResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()


def is_rate_limited(request: Request, action: str) -> bool:
    return ratelimiter.backend.is_limited(
        f"auth:recovery:{action}:{request.META['REMOTE_ADDR']}",
        limit=5,
        window=60,
    )


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthRecoveryEndpoint(Endpoint):
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()
    csrf_protect = True

    @extend_schema(
        operation_id="Request account password recovery",
        request=AuthRecoveryRequestSerializer,
        responses={202: AuthRecoveryAcceptedSerializer},
    )
    def post(self, request: Request) -> Response:
        if is_rate_limited(request, "request"):
            return Response({"detail": "Too many password recovery attempts"}, status=429)

        serializer = AuthRecoveryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        users = find_users(serializer.validated_data["user"].strip(), with_valid_password=False)
        if (
            len(users) == 1
            and not users[0].is_managed
            and not getattr(users[0], "is_suspended", False)
        ):
            user = users[0]
            password_hash = LostPasswordHash.for_user(user)
            LostPasswordHash.send_recover_password_email(
                user, password_hash.hash, request.META["REMOTE_ADDR"]
            )

        return Response(
            serialize(AuthRecoveryAccepted(), request.user, AuthRecoveryAcceptedSerializer()),
            status=202,
        )


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthRecoveryConfirmEndpoint(Endpoint):
    # TODO(epurkhiser): Support password recovery during self-hosted relocation.
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.FOUNDATIONS
    permission_classes = ()
    csrf_protect = True

    @extend_schema(
        operation_id="Validate account password recovery token",
        parameters=[AuthRecoveryTokenRequestSerializer],
        responses={200: AuthRecoveryTokenResponseSerializer},
    )
    def get(self, request: Request) -> Response:
        if is_rate_limited(request, "validate"):
            return Response({"detail": "Too many password recovery attempts"}, status=429)

        serializer = AuthRecoveryTokenRequestSerializer(data=request.query_params.dict())
        serializer.is_valid(raise_exception=True)
        password_hash = (
            LostPasswordHash.objects.select_related("user")
            .filter(
                user_id=serializer.validated_data["user_id"],
                hash=serializer.validated_data["token"],
            )
            .first()
        )
        valid = bool(
            password_hash is not None
            and password_hash.is_valid()
            and not password_hash.user.is_managed
            and not getattr(password_hash.user, "is_suspended", False)
        )
        response: AuthRecoveryTokenResponse = {"valid": valid}
        return Response(response)

    @extend_schema(
        operation_id="Complete account password recovery",
        request=AuthRecoveryConfirmRequestSerializer,
        responses={204: None},
    )
    def post(self, request: Request) -> Response:
        if is_rate_limited(request, "confirm"):
            return Response({"detail": "Too many password recovery attempts"}, status=429)

        serializer = AuthRecoveryConfirmRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_id = serializer.validated_data["user_id"]
        token = serializer.validated_data["token"]
        password = serializer.validated_data["password"]

        password_hash = (
            LostPasswordHash.objects.select_related("user")
            .filter(user_id=user_id, hash=token)
            .first()
        )
        if password_hash is None:
            return Response({"detail": "Invalid or expired recovery token"}, status=400)
        if not password_hash.is_valid():
            password_hash.delete()
            return Response({"detail": "Invalid or expired recovery token"}, status=400)

        user = password_hash.user
        if getattr(user, "is_suspended", False) or user.is_managed:
            password_hash.delete()
            return Response({"detail": "Invalid or expired recovery token"}, status=400)

        try:
            password_validation.validate_password(password, user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": error.messages}) from error

        database = router.db_for_write(User)
        with transaction.atomic(database):
            password_hash = (
                LostPasswordHash.objects.select_for_update()
                .select_related("user")
                .filter(user_id=user_id, hash=token)
                .first()
            )
            if password_hash is None:
                return Response({"detail": "Invalid or expired recovery token"}, status=400)
            if not password_hash.is_valid():
                password_hash.delete()
                return Response({"detail": "Invalid or expired recovery token"}, status=400)

            user = password_hash.user
            if getattr(user, "is_suspended", False) or user.is_managed:
                password_hash.delete()
                return Response({"detail": "Invalid or expired recovery token"}, status=400)

            user.set_password(password)
            user.refresh_session_nonce()
            user.save()
            password_hash.delete()

            transaction.on_commit(
                lambda: user_service.verify_user_email(email=user.email, user_id=user.id),
                using=database,
            )

        capture_security_activity(
            account=user,
            type="password-changed",
            actor=user,
            ip_address=request.META["REMOTE_ADDR"],
            send_email=True,
        )
        reset_2fa_rate_limits(user.id)

        return self.get_success_response(request, user)

    def get_success_response(self, request: Request, user: User) -> Response:
        return Response(status=204)


@extend_schema(tags=["Users"])
@control_silo_endpoint
class AuthPasswordAssignmentEndpoint(AuthRecoveryConfirmEndpoint):
    @extend_schema(
        operation_id="Validate account password assignment token",
        parameters=[AuthRecoveryTokenRequestSerializer],
        responses={200: AuthRecoveryTokenResponseSerializer},
    )
    def get(self, request: Request) -> Response:
        return super().get(request)

    @extend_schema(
        operation_id="Assign account password",
        request=AuthRecoveryConfirmRequestSerializer,
        responses={200: AuthPasswordAssignmentResponseSerializer},
    )
    def post(self, request: Request) -> Response:
        return super().post(request)

    def get_success_response(self, request: Request, user: User) -> Response:
        if user.has_2fa():
            return Response({"nextUri": reverse("sentry-login")})

        authenticated_user = authenticate(username=user.username, password=request.data["password"])
        assert isinstance(authenticated_user, User), authenticated_user
        auth.login(request, authenticated_user)
        payload: AuthPasswordAssignmentResponse = {
            "nextUri": get_auth_success_payload(request, authenticated_user)["nextUri"]
        }
        return Response(payload)
