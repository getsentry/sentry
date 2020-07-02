from __future__ import absolute_import

from base64 import b64decode
from django.conf import settings
from rest_framework import serializers
from PIL import Image
from six import BytesIO

from sentry.api.exceptions import SentryAPIException

# These values must be synced with the avatar cropper in frontend.
MIN_DIMENSION = 256
MAX_DIMENSION = 1024
ALLOWED_MIMETYPES = ("image/gif", "image/jpeg", "image/png")


class ImageTooLarge(SentryAPIException):
    status_code = 413
    default_detail = "Image too large"
    default_code = "too_large"


class AvatarField(serializers.Field):
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

    def to_representation(self, value):
        if not value:
            return ""
        return value.getvalue()

    def to_internal_value(self, data):
        if not data:
            return None
        data = b64decode(data)
        if len(data) > self.max_size:
            raise ImageTooLarge()

        with Image.open(BytesIO(data)) as img:
            if Image.MIME[img.format] not in ALLOWED_MIMETYPES:
                raise serializers.ValidationError("Invalid image format.")

            width, height = img.size
            if not self.is_valid_size(width, height):
                raise serializers.ValidationError("Invalid image dimensions.")

        return BytesIO(data)

    def is_valid_size(self, width, height):
        if width != height:
            return False
        if width < self.min_dimension:
            return False
        if width > self.max_dimension:
            return False
        return True
