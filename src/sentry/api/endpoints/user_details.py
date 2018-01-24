from __future__ import absolute_import

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.auth import password_validation
from sentry.auth.superuser import is_active_superuser
from sentry.models import User, UserOption
from sentry.security import capture_security_activity


class BaseUserSerializer(serializers.ModelSerializer):
    def validate_username(self, attrs, source):
        value = attrs[source]
        if User.objects.filter(username__iexact=value).exclude(id=self.object.id).exists():
            raise serializers.ValidationError('That username is already in use.')
        return attrs

    def validate(self, attrs):
        attrs = super(BaseUserSerializer, self).validate(attrs)

        if self.object.email == self.object.username:
            if attrs.get('username', self.object.email) != self.object.email:
                attrs.setdefault('email', attrs['username'])

        return attrs

    def restore_object(self, attrs, instance=None):
        instance = super(BaseUserSerializer, self).restore_object(attrs, instance)
        instance.is_active = attrs.get('isActive', instance.is_active)
        return instance


class UserSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = ('name', )

    def validate(self, attrs):
        for field in settings.SENTRY_MANAGED_USER_FIELDS:
            attrs.pop(field, None)

        attrs = super(UserSerializer, self).validate(attrs)

        return attrs


class AdminUserSerializer(BaseUserSerializer):
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = User
        # no idea wtf is up with django rest framework, but we need is_active
        # and isActive
        fields = ('name', 'isActive')
        # write_only_fields = ('password',)


class UserSudoSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = ('password', 'username', 'email')

    def validate_password(self, attrs, source):
        # this will raise a ValidationError if password is invalid
        password_validation.validate_password(attrs[source])

        return attrs


class UserDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        data = serialize(user, request.user, DetailedUserSerializer())
        return Response(data)

    @sudo_required
    def protected_put(self, request, user):
        serializer = UserSudoSerializer(user, data=request.DATA, partial=True)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.object

        if request.DATA.get('password'):
            if request.DATA.get('password') != request.DATA.get('passwordVerify'):
                return Response({"detail": "New password does not match verified password"},
                                status=status.HTTP_400_BAD_REQUEST)

            # TODO(billy): Why is `user.has_usable_password()` false here
            if user.is_managed:
                return Response({"detail": "Not allowed to change password"},
                                status=status.HTTP_400_BAD_REQUEST)

            user.set_password(result.password)
            user.refresh_session_nonce(request._request)

            capture_security_activity(
                account=result,
                type='password-changed',
                actor=result,
                ip_address=request.META['REMOTE_ADDR'],
                send_email=True,
            )

        serializer.save()

        # Proceed to update unprivileged fields
        return self.update_unprivileged_details(request, user)

    def put(self, request, user):
        # Changing `password`, `email`, or `username` requires sudo
        if request.DATA.get('passwordVerify') or \
                request.DATA.get('password') or \
                request.DATA.get('username') or \
                request.DATA.get('email'):
            return self.protected_put(request, user)
        else:
            return self.update_unprivileged_details(request, user)

    def update_unprivileged_details(self, request, user):
        if is_active_superuser(request):
            serializer_cls = AdminUserSerializer
        else:
            serializer_cls = UserSerializer
        serializer = serializer_cls(user, data=request.DATA, partial=True)

        if serializer.is_valid():
            user = serializer.save()

            options = request.DATA.get('options', {})
            if options.get('seenReleaseBroadcast'):
                UserOption.objects.set_value(
                    user=user,
                    key='seen_release_broadcast',
                    value=options.get('seenReleaseBroadcast'),
                )
            return Response(serialize(user, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
