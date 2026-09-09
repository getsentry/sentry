from __future__ import annotations

from base64 import b64encode
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.auth.authenticators.base import ActivationChallengeResult, ActivationMessageResult
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
class AuthDetail:
    detail: str


class AuthDetailSerializerResponse(TypedDict):
    detail: str


class AuthDetailSerializer(Serializer[AuthDetailSerializerResponse]):
    def serialize(
        self,
        obj: AuthDetail,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthDetailSerializerResponse:
        return {"detail": obj.detail}


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


@dataclass(frozen=True)
class AuthMfaWebAuthnChallenge:
    challenge: str


@dataclass(frozen=True)
class AuthMfaSmsChallenge:
    expires_in: int


class AuthMfaWebAuthnChallengeData(TypedDict):
    webAuthnAuthenticationData: str


class AuthMfaWebAuthnChallengeSerializerResponse(TypedDict):
    method: Literal["u2f"]
    challenge: AuthMfaWebAuthnChallengeData


class AuthMfaSmsChallengeSerializerResponse(TypedDict):
    method: Literal["sms"]
    expiresIn: int


AuthMfaChallengeSerializerResponse = (
    AuthMfaWebAuthnChallengeSerializerResponse | AuthMfaSmsChallengeSerializerResponse
)


class AuthMfaWebAuthnChallengeSerializer(Serializer[AuthMfaWebAuthnChallengeSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaWebAuthnChallenge,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaWebAuthnChallengeSerializerResponse:
        return {
            "method": "u2f",
            "challenge": {"webAuthnAuthenticationData": obj.challenge},
        }


class AuthMfaSmsChallengeSerializer(Serializer[AuthMfaSmsChallengeSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaSmsChallenge,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaSmsChallengeSerializerResponse:
        return {"method": "sms", "expiresIn": obj.expires_in}


class AuthMfaChallengeSerializer(Serializer[AuthMfaChallengeSerializerResponse]):
    def serialize(
        self,
        obj: AuthMfaWebAuthnChallenge | AuthMfaSmsChallenge,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthMfaChallengeSerializerResponse:
        if isinstance(obj, AuthMfaWebAuthnChallenge):
            return AuthMfaWebAuthnChallengeSerializer().serialize(obj, attrs, user)
        return AuthMfaSmsChallengeSerializer().serialize(obj, attrs, user)


def serialize_activation(
    method: str,
    activation: ActivationChallengeResult | ActivationMessageResult,
    user: User,
) -> AuthMfaChallengeSerializerResponse:
    challenge: AuthMfaWebAuthnChallenge | AuthMfaSmsChallenge

    if isinstance(activation, ActivationChallengeResult):
        challenge = AuthMfaWebAuthnChallenge(b64encode(activation.challenge).decode("ascii"))
    elif method == "sms" and activation.expires_in is not None:
        challenge = AuthMfaSmsChallenge(activation.expires_in)
    else:
        raise ValueError(f"Unsupported activation result for method: {method}")

    return serialize(challenge, user, AuthMfaChallengeSerializer())


class AuthRecoveryAccepted:
    pass


class AuthRecoveryAcceptedSerializerResponse(TypedDict):
    detail: str


class AuthRecoveryAcceptedSerializer(Serializer[AuthRecoveryAcceptedSerializerResponse]):
    def serialize(
        self,
        obj: AuthRecoveryAccepted,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthRecoveryAcceptedSerializerResponse:
        return {"detail": "If an eligible account exists, a recovery email has been sent."}


class AuthOrganizationConfigOrganization(TypedDict):
    avatarUrl: str | None
    name: str
    slug: str


class AuthOrganizationConfigProvider(TypedDict):
    key: str
    name: str


# Serializer attribute maps use response objects as identity-keyed dictionary keys.
@dataclass(eq=False)
class AuthOrganizationConfig:
    """Organization login configuration and the caller's authentication state."""

    authenticated: bool
    """Whether the caller has a global Sentry session."""

    member_authenticated: bool
    """Whether the caller can access this organization, including required SSO."""

    can_register: bool
    join_request_url: str | None
    login_method: Literal["password", "sso"]
    sso_required: bool
    organization: AuthOrganizationConfigOrganization
    provider: AuthOrganizationConfigProvider | None
    warnings: list[str]


class AuthOrganizationConfigSerializerResponse(TypedDict):
    authenticated: bool
    memberAuthenticated: bool
    canRegister: bool
    joinRequestUrl: str | None
    loginMethod: Literal["password", "sso"]
    ssoRequired: bool
    organization: AuthOrganizationConfigOrganization
    provider: AuthOrganizationConfigProvider | None
    warnings: list[str]


class AuthOrganizationConfigSerializer(Serializer[AuthOrganizationConfigSerializerResponse]):
    def serialize(
        self,
        obj: AuthOrganizationConfig,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthOrganizationConfigSerializerResponse:
        return {
            "authenticated": obj.authenticated,
            "memberAuthenticated": obj.member_authenticated,
            "canRegister": obj.can_register,
            "joinRequestUrl": obj.join_request_url,
            "loginMethod": obj.login_method,
            "ssoRequired": obj.sso_required,
            "organization": obj.organization,
            "provider": obj.provider,
            "warnings": obj.warnings,
        }
