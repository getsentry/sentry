from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.users.api.serializers.user import (
    DetailedSelfUserSerializer,
    DetailedSelfUserSerializerResponse,
)
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


@dataclass(frozen=True)
class AuthSuccess:
    user: User
    next_uri: str


class AuthSuccessSerializerResponse(TypedDict):
    nextUri: str
    user: DetailedSelfUserSerializerResponse


class AuthSuccessSerializer(Serializer[AuthSuccessSerializerResponse]):
    def serialize(
        self,
        obj: AuthSuccess,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthSuccessSerializerResponse:
        return {
            "nextUri": obj.next_uri,
            "user": serialize(obj.user, user, DetailedSelfUserSerializer()),
        }


def serialize_auth_success(user: User, next_uri: str) -> AuthSuccessSerializerResponse:
    return serialize(AuthSuccess(user=user, next_uri=next_uri), user, AuthSuccessSerializer())


@dataclass(frozen=True)
class AuthMfaMethod:
    id: str


class AuthMfaOtpMethodSerializerResponse(TypedDict):
    id: Literal["totp", "sms", "recovery"]


class AuthMfaWebAuthnMethodSerializerResponse(TypedDict):
    id: Literal["u2f"]


AuthMfaMethodSerializerResponse = (
    AuthMfaOtpMethodSerializerResponse | AuthMfaWebAuthnMethodSerializerResponse
)


class AuthMfaOtpMethodSerializer(Serializer[AuthMfaOtpMethodSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaMethod,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaOtpMethodSerializerResponse:
        if obj.id == "totp":
            return {"id": "totp"}
        if obj.id == "sms":
            return {"id": "sms"}
        if obj.id == "recovery":
            return {"id": "recovery"}
        raise ValueError(f"Unsupported OTP method: {obj.id}")


class AuthMfaWebAuthnMethodSerializer(Serializer[AuthMfaWebAuthnMethodSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaMethod,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaWebAuthnMethodSerializerResponse:
        if obj.id != "u2f":
            raise ValueError(f"Unsupported WebAuthn method: {obj.id}")
        return {"id": "u2f"}


class AuthMfaMethodSerializer(Serializer[AuthMfaMethodSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaMethod,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaMethodSerializerResponse:
        if obj.id == "u2f":
            return AuthMfaWebAuthnMethodSerializer().serialize(obj, attrs, user)
        return AuthMfaOtpMethodSerializer().serialize(obj, attrs, user)


@dataclass(frozen=True)
class AuthMfaRequired:
    methods: tuple[AuthMfaMethod, ...]


class AuthMfaRequiredSerializerResponse(TypedDict):
    mfaRequired: bool
    mfaMethods: list[AuthMfaMethodSerializerResponse]


class AuthMfaRequiredSerializer(Serializer[AuthMfaRequiredSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaRequired,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaRequiredSerializerResponse:
        return {
            "mfaRequired": True,
            "mfaMethods": serialize(list(obj.methods), user, AuthMfaMethodSerializer()),
        }


def serialize_auth_mfa_required(
    user: User, method_ids: Sequence[str]
) -> AuthMfaRequiredSerializerResponse:
    methods = tuple(AuthMfaMethod(method_id) for method_id in method_ids)
    return serialize(AuthMfaRequired(methods), user, AuthMfaRequiredSerializer())
