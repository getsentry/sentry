from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register
from sentry.models import (
    AuthenticatorInterface,
    RecoveryCodeInterface,
    SmsInterface,
    TotpInterface,
    U2fInterface,
)


@register(AuthenticatorInterface)
class AuthenticatorInterfaceSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            "id": six.text_type(obj.interface_id),
            "name": obj.name,
            "description": obj.description,
            "enrollButton": obj.enroll_button,
            "configureButton": obj.configure_button,
            "removeButton": obj.remove_button,
            "isBackupInterface": obj.is_backup_interface,
            "isEnrolled": obj.is_enrolled,
            "canValidateOtp": obj.can_validate_otp,
            "allowMultiEnrollment": obj.allow_multi_enrollment,
        }

        # authenticator is enrolled
        if obj.authenticator is not None:
            data["authId"] = six.text_type(obj.authenticator.id)
            data["createdAt"] = obj.authenticator.created_at
            data["lastUsedAt"] = obj.authenticator.last_used_at

        return data


@register(SmsInterface)
class SmsInterfaceSerializer(AuthenticatorInterfaceSerializer):
    def serialize(self, obj, attrs, user):
        data = super(SmsInterfaceSerializer, self).serialize(obj, attrs, user)
        data["phone"] = obj.phone_number
        return data


for interface in RecoveryCodeInterface, TotpInterface, U2fInterface:
    register(interface)(AuthenticatorInterfaceSerializer)
