from __future__ import absolute_import

from django.utils.crypto import constant_time_compare
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.auth import password_validation
from sentry.models import User
from sentry.security import capture_security_activity


class UserPasswordSerializer(serializers.ModelSerializer):
    passwordVerify = serializers.CharField(max_length=128, required=True)
    passwordNew = serializers.CharField(max_length=128, required=True)
    password = serializers.CharField(max_length=128, required=True)

    class Meta:
        model = User
        fields = ('password', 'passwordNew', 'passwordVerify', )

    def validate_passwordNew(self, attrs, source):
        # this will raise a ValidationError if password is invalid
        password_validation.validate_password(attrs[source])

        if self.context['is_managed'] or not self.context['has_usable_password']:
            raise serializers.ValidationError('Not allowed to change password')

        return attrs

    def validate(self, attrs):
        attrs = super(UserPasswordSerializer, self).validate(attrs)

        if not self.object.check_password(attrs.get('password')):
            raise serializers.ValidationError('The password you entered is not correct.')

        # make sure `passwordNew` matches `passwordVerify`
        if not constant_time_compare(attrs.get('passwordNew'), attrs.get('passwordVerify')):
            raise serializers.ValidationError(
                'Your new password and verify new password must match.')

        return attrs


class UserPasswordEndpoint(UserEndpoint):
    @sudo_required
    def put(self, request, user):
        # pass some context to serializer otherwise when we create a new serializer instance,
        # user.password gets set to new plaintext password from request and
        # `user.has_usable_password` becomes False
        serializer = UserPasswordSerializer(user, data=request.DATA, context={
            'is_managed': user.is_managed,
            'has_usable_password': user.has_usable_password(),
        })

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.object

        user.set_password(result.passwordNew)
        user.refresh_session_nonce(request._request)
        user.clear_lost_passwords()

        user = serializer.save()

        capture_security_activity(
            account=user,
            type='password-changed',
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            send_email=True,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

        return Response(status=status.HTTP_400_BAD_REQUEST)
