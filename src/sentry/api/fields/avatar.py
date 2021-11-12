import re
from base64 import b64decode
from io import BytesIO

from django.conf import settings
from PIL import Image
from rest_framework import serializers
from svglib.svglib import load_svg_file

from sentry.api.exceptions import SentryAPIException

# These values must be synced with the avatar cropper in frontend.
MIN_DIMENSION = 256
MAX_DIMENSION = 1024
ALLOWED_MIMETYPES = ("image/gif", "image/jpeg", "image/png")

SVG_R = r"(?:<\?xml\b[^>]*>[^<]*)?(?:<!--.*?-->[^<]*)*(?:<svg|<!DOCTYPE svg)\b"
SVG_RE = re.compile(SVG_R, re.DOTALL)
MIN_SVG_DIMENSION = 16
MAX_SVG_DIMENSION = 80


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
        **kwargs,
    ):
        super().__init__(**kwargs)
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

        # TODO: feature flag this? we only want to allow svgs for sentryapps
        # but there is no way to get org context from this currently
        if SVG_RE.match(data.decode("utf-8")) is not None:
            svg = load_svg_file(BytesIO(data))
            if svg is not None:
                viewbox = svg.get("viewBox").split()
                if not self.is_valid_svg_size(viewbox):
                    raise serializers.ValidationError("Invalid image dimensions.")

                return BytesIO(data)
            raise serializers.ValidationError("Could not open file.")

        with Image.open(BytesIO(data)) as img:
            if Image.MIME[img.format] not in ALLOWED_MIMETYPES:
                raise serializers.ValidationError("Invalid image format.")

            width, height = img.size
            if not self.is_valid_size(width, height):
                raise serializers.ValidationError("Invalid image dimensions.")

        return BytesIO(data)

    def is_valid_svg_size(self, viewbox):
        converted = [int(dimension) for dimension in viewbox][-2:]
        width = converted[0]
        height = converted[1]

        if width != height:
            return False
        if width < MIN_SVG_DIMENSION:
            return False
        if width > MAX_SVG_DIMENSION:
            return False
        return True

    def is_valid_size(self, width, height):
        if width != height:
            return False
        if width < self.min_dimension:
            return False
        if width > self.max_dimension:
            return False
        return True
