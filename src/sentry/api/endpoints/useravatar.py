from __future__ import absolute_import

import base64

from django.conf import settings
from PIL import Image
from rest_framework import status
from rest_framework.response import Response
from six import BytesIO
from uuid import uuid4

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.models import UserAvatar, File


MIN_DIMENSION = 256

MAX_DIMENSION = 1024


class UserAvatarEndpoint(UserEndpoint):
    FILE_TYPE = 'avatar.file'

    def get(self, request, user):
        return Response(serialize(user, request.user))

    def is_valid_size(self, width, height):
        if width != height:
            return False
        if width < MIN_DIMENSION:
            return False
        if width > MAX_DIMENSION:
            return False
        return True

    def put(self, request, user):
        if user != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        photo_string = request.DATA.get('avatar_photo')
        photo = None
        if photo_string:
            photo_string = base64.b64decode(photo_string)
            if len(photo_string) > settings.SENTRY_MAX_AVATAR_SIZE:
                return Response({'error': 'Image too large.'},
                                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
            try:
                with Image.open(BytesIO(photo_string)) as img:
                    width, height = img.size
                    if not self.is_valid_size(width, height):
                        return Response({'error': 'Image invalid size.'},
                                        status=status.HTTP_400_BAD_REQUEST)
            except IOError:
                return Response({'error': 'Invalid image format.'},
                                status=status.HTTP_400_BAD_REQUEST)
            file_name = '%s.png' % user.id
            photo = File.objects.create(name=file_name, type=self.FILE_TYPE)
            photo.putfile(BytesIO(photo_string))

        avatar, _ = UserAvatar.objects.get_or_create(user=user)
        if avatar.file and photo:
            avatar.file.delete()
            avatar.clear_cached_photos()
        if photo:
            avatar.file = photo
            avatar.ident = uuid4().hex

        avatar_type = request.DATA.get('avatar_type')

        if not avatar.file and avatar_type == 'upload':
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if avatar_type:
            try:
                avatar.avatar_type = [i for i, n in UserAvatar.AVATAR_TYPES if n == avatar_type][0]
            except IndexError:
                return Response(status=status.HTTP_400_BAD_REQUEST)

        avatar.save()
        return Response(serialize(user, request.user))
