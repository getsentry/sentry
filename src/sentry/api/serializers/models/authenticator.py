from sentry.api.serializers import Serializer, register
from sentry.auth.authenticators.base import AuthenticatorInterface
from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface


@register(AuthenticatorInterface)
class AuthenticatorInterfaceSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": str(obj.interface_id),
            "name": obj.name,
            "description": obj.description,
            "rotationWarning": obj.rotation_warning,
            "enrollButton": obj.enroll_button,
            "configureButton": obj.configure_button,
            "removeButton": obj.remove_button,
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


@register(SmsInterface)
class SmsInterfaceSerializer(AuthenticatorInterfaceSerializer):
    def serialize(self, obj, attrs, user, **kwargs):
        data = super().serialize(obj, attrs, user)
        data["phone"] = obj.phone_number
        return data


for interface in RecoveryCodeInterface, TotpInterface, U2fInterface:
    register(interface)(AuthenticatorInterfaceSerializer)
