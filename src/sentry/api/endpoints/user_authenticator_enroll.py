from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

import petname

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.models import Authenticator
from sentry.security import capture_security_activity


ALREADY_ENROLLED_ERR = {'details': 'Already enrolled'}
INVALID_OTP_ERR = {'details': 'Invalid OTP'},
SEND_SMS_ERR = {'details': 'Error sending SMS'}


class TotpRestSerializer(serializers.Serializer):
    otp = serializers.CharField(
        label='One-time password',
        help_text='Code from authenticator',
        required=True,
        max_length=20
    )


class SmsRestSerializer(serializers.Serializer):
    phone = serializers.CharField(
        label="Phone number",
        help_text="Phone number to send SMS code",
        required=True,
        max_length=20,
    )
    otp = serializers.CharField(
        label='One-time password',
        help_text='Code from authenticator',
        required=False,
        max_length=20
    )


class U2fRestSerializer(serializers.Serializer):
    deviceName = serializers.CharField(
        label='Device name',
        required=False,
        max_length=60,
        default=lambda: petname.Generate(2, ' ', letters=10).title(),
    )
    challenge = serializers.CharField(
        required=True,
    )
    response = serializers.CharField(
        required=True,
    )

serializer_map = {
    'totp': TotpRestSerializer,
    'sms': SmsRestSerializer,
    'u2f': U2fRestSerializer,
}


def get_serializer_field_metadata(serializer, fields=None):
    """Returns field metadata for serializer"""
    meta = []
    for field in serializer.base_fields:
        if fields is None or field in fields:
            serialized_field = dict(serializer.base_fields[field].metadata())
            serialized_field['name'] = field
            serialized_field['defaultValue'] = serializer.base_fields[field].get_default_value()
            meta.append(serialized_field)

    return meta


class UserAuthenticatorEnrollEndpoint(UserEndpoint):
    @sudo_required
    def get(self, request, user, interface_id):
        """
        Get Authenticator Interface
        ```````````````````````````

        Retrieves authenticator interface details for user depending on user enrollment status

        :pparam string user_id: user id or "me" for current user
        :pparam string interface_id: interface id

        :auth: required
        """

        interface = Authenticator.objects.get_interface(user, interface_id)

        # Not all interfaces allow multi enrollment
        if interface.is_enrolled and not interface.allow_multi_enrollment:
            return Response(ALREADY_ENROLLED_ERR, status=status.HTTP_400_BAD_REQUEST)

        # User is not enrolled in auth interface:
        # - display configuration form
        response = serialize(interface)
        response['form'] = get_serializer_field_metadata(
            serializer_map[interface_id]
        )

        # U2fInterface has no 'secret' attribute
        try:
            response['secret'] = interface.secret
        except AttributeError:
            pass

        if interface_id == 'totp':
            response['qrcode'] = interface.get_provision_qrcode(user.email)

        if interface_id == 'u2f':
            response['challenge'] = interface.start_enrollment()

        return Response(response)

    @sudo_required
    def post(self, request, user, interface_id):
        """
        Enroll in authenticator interface
        `````````````````````````````````

        :pparam string user_id: user id or "me" for current user
        :pparam string interface_id: interface id

        :auth: required
        """

        # Using `request.user` here because superuser should not be able to set a user's 2fa

        # start activation
        serializer_cls = serializer_map.get(interface_id, None)

        if serializer_cls is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = serializer_cls(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        interface = Authenticator.objects.get_interface(request.user, interface_id)

        # Not all interfaces allow multi enrollment
        #
        # This is probably un-needed because we catch
        # `Authenticator.AlreadyEnrolled` when attempting to enroll
        if interface.is_enrolled and not interface.allow_multi_enrollment:
            return Response(ALREADY_ENROLLED_ERR, status=status.HTTP_400_BAD_REQUEST)

        try:
            interface.secret = request.DATA['secret']
        except KeyError:
            pass

        # Need to update interface with phone number before validating OTP
        if 'phone' in request.DATA:
            interface.phone_number = serializer.data['phone']

            # Disregarding value of 'otp', if no OTP was provided,
            # send text message to phone number with OTP
            if 'otp' not in request.DATA:
                if interface.send_text(for_enrollment=True, request=request._request):
                    return Response(status=status.HTTP_204_NO_CONTENT)
                else:
                    # Error sending text message
                    return Response(SEND_SMS_ERR, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Attempt to validate OTP
        if 'otp' in request.DATA and not interface.validate_otp(serializer.data['otp']):
            return Response(INVALID_OTP_ERR, status=status.HTTP_400_BAD_REQUEST)

        # Try u2f enrollment
        if interface_id == 'u2f':
            # What happens when this fails?
            interface.try_enroll(
                serializer.data['challenge'],
                serializer.data['response'],
                serializer.data['deviceName']
            )

        try:
            interface.enroll(request.user)
        except Authenticator.AlreadyEnrolled:
            return Response(ALREADY_ENROLLED_ERR, status=status.HTTP_400_BAD_REQUEST)
        else:
            capture_security_activity(
                account=request.user,
                type='mfa-added',
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                context={
                    'authenticator': interface.authenticator,
                },
                send_email=False,
            )
            request.user.clear_lost_passwords()
            request.user.refresh_session_nonce(self.request)
            request.user.save()
            Authenticator.objects.auto_add_recovery_codes(request.user)

            return Response(status=status.HTTP_204_NO_CONTENT)
