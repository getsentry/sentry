from __future__ import absolute_import

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.models import User


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
        fields = ('name', 'username', 'email')

    def validate_username(self, attrs, source):
        value = attrs[source]
        if User.objects.filter(username__iexact=value).exclude(id=self.object.id).exists():
            raise serializers.ValidationError('That username is already in use.')
        return attrs

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
        fields = ('name', 'username', 'isActive', 'email')
        # write_only_fields = ('password',)


class UserDetailsEndpoint(UserEndpoint):
    def get(self, request, user):
        data = serialize(user, request.user, DetailedUserSerializer())
        return Response(data)

    def put(self, request, user):
        if request.is_superuser():
            serializer_cls = AdminUserSerializer
        else:
            serializer_cls = UserSerializer

        serializer = serializer_cls(user, data=request.DATA, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            return Response(serialize(user, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
