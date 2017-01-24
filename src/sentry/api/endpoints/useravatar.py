from __future__ import absolute_import

from rest_framework import status
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.fields import AvatarField
from sentry.api.serializers import serialize
from sentry.models import UserAvatar


class UserAvatarSerializer(serializers.Serializer):
    avatar_photo = AvatarField(required=False)
    avatar_type = serializers.ChoiceField(choices=(
        ('upload', 'upload'),
        ('gravatar', 'gravatar'),
        ('letter_avatar', 'letter_avatar'),
    ))

    def validate(self, attrs):
        attrs = super(UserAvatarSerializer, self).validate(attrs)
        if attrs.get('avatar_type') == 'upload':
            has_existing_file = UserAvatar.objects.filter(
                user=self.context['user'],
                file__isnull=False,
            ).exists()
            if not has_existing_file and not attrs.get('avatar_photo'):
                raise serializers.ValidationError({
                    'avatar_type': 'Cannot set avatar_type to upload without avatar_photo',
                })
        return attrs


class UserAvatarEndpoint(UserEndpoint):
    def get(self, request, user):
        return Response(serialize(user, request.user))

    def put(self, request, user):
        if user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = UserAvatarSerializer(
            data=request.DATA,
            context={'user': user},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        result = serializer.object

        UserAvatar.save_avatar(
            relation={'user': user},
            type=result['avatar_type'],
            avatar=result.get('avatar_photo'),
            filename='{}.png'.format(user.id),
        )

        return Response(serialize(user, request.user))
