from __future__ import absolute_import

from base64 import b64decode
from django.conf import settings
from rest_framework import serializers
from rest_framework.exceptions import APIException
from PIL import Image
from six import BytesIO

MIN_DIMENSION = 256

MAX_DIMENSION = 1024


class ImageTooLarge(APIException):
    status_code = 413
    default_detail = 'Image too large'
    default_code = 'too_large'


class AvatarField(serializers.WritableField):
    def __init__(
        self,
        max_size=settings.SENTRY_MAX_AVATAR_SIZE,
        min_dimension=MIN_DIMENSION,
        max_dimension=MAX_DIMENSION,
        **kwargs
    ):
        super(AvatarField, self).__init__(**kwargs)
        self.max_size = max_size
        self.min_dimension = min_dimension
        self.max_dimension = max_dimension

    def to_native(self, obj):
        if not obj:
            return ''
        return obj.getvalue()

    def from_native(self, data):
        if not data:
            return None
        data = b64decode(data)
        if len(data) > self.max_size:
            raise ImageTooLarge()

        try:
            with Image.open(BytesIO(data)) as img:
                width, height = img.size
                if not self.is_valid_size(width, height):
                    raise APIException('Invalid image dimensions.', status_code=400)
        except IOError:
            raise serializers.ValidationError('Invalid image format.')

        return BytesIO(data)

    def is_valid_size(self, width, height):
        if width != height:
            return False
        if width < self.min_dimension:
            return False
        if width > self.max_dimension:
            return False
        return True
