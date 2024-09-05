from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict, cast

from sentry.api.serializers import Serializer, register
from sentry.auth.authenticators.base import AuthenticatorInterface
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.users.models.user import User


def get_interface_serializer(interface: AuthenticatorInterface) -> AuthenticatorInterface:
    if isinstance(interface, SmsInterface):
        return SmsInterfaceSerializer()
    return AuthenticatorInterfaceSerializer()


class EnrolledAuthenticatorInterfaceSerializerResponse(TypedDict, total=False):
    authId: str
    createdAt: datetime
    lastUsedAt: datetime | None


class AuthenticatorInterfaceSerializerResponse(EnrolledAuthenticatorInterfaceSerializerResponse):
    id: str
    name: str
    description: str
    rotationWarning: str
    enrollButton: str
    configureButton: str
    removeButton: str
    isBackupInterface: bool
    isEnrolled: bool
    disallowNewEnrollment: bool
    status: str
    canValidateOtp: bool
    allowMultiEnrollment: bool
    allowRotationInPlace: bool


@register(AuthenticatorInterface)
class AuthenticatorInterfaceSerializer(Serializer):
    def serialize(
        self,
        obj: AuthenticatorInterface,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> AuthenticatorInterfaceSerializerResponse:
        data: AuthenticatorInterfaceSerializerResponse = {
            "id": str(obj.interface_id),
            "name": str(obj.name),
            "description": str(obj.description),
            "rotationWarning": str(obj.rotation_warning),
            "enrollButton": str(obj.enroll_button),
            "configureButton": str(obj.configure_button),
            "removeButton": str(obj.remove_button),
            "isBackupInterface": obj.is_backup_interface,
            "isEnrolled": obj.is_enrolled(),
            "disallowNewEnrollment": obj.disallow_new_enrollment,
            "status": str(obj.status.value),
            "canValidateOtp": obj.can_validate_otp,
            "allowMultiEnrollment": obj.allow_multi_enrollment,
            "allowRotationInPlace": obj.allow_rotation_in_place,
        }

        # authenticator is enrolled
        if obj.authenticator is not None:
            data["authId"] = str(obj.authenticator.id)
            data["createdAt"] = obj.authenticator.created_at
            data["lastUsedAt"] = obj.authenticator.last_used_at

        return data


class SmsInterfaceSerializerResponse(AuthenticatorInterfaceSerializerResponse):
    phone: str


@register(SmsInterface)
class SmsInterfaceSerializer(AuthenticatorInterfaceSerializer):
    def serialize(
        self,
        obj: AuthenticatorInterface,
        attrs: Mapping[str, Any],
        user: User,
        **kwargs: Any,
    ) -> SmsInterfaceSerializerResponse:
        data = cast(SmsInterfaceSerializerResponse, super().serialize(obj, attrs, user))
        assert isinstance(
            obj, SmsInterface
        ), "Interface must be SmsInterface to serialize phone number"
        data["phone"] = obj.phone_number
        return data


for interface in RecoveryCodeInterface, TotpInterface, U2fInterface:
    register(interface)(AuthenticatorInterfaceSerializer)
