from __future__ import annotations

from base64 import b64decode
from io import BytesIO
from typing import TYPE_CHECKING, TypedDict, Unpack

from django.conf import settings
from PIL import Image
from rest_framework import serializers

from sentry.api.exceptions import SentryAPIException

if TYPE_CHECKING:
    from collections.abc import Sequence

    from django_stubs_ext import StrOrPromise
    from rest_framework.fields import _DefaultInitial
    from rest_framework.validators import Validator

# These values must be synced with the avatar cropper in frontend.
MIN_DIMENSION = 256
MAX_DIMENSION = 1024
ALLOWED_MIMETYPES = ("image/gif", "image/jpeg", "image/png")
SENTRY_APP_ALLOWED_MIMETYPES = "image/png"


class ImageTooLarge(SentryAPIException):
    status_code = 413
    default_detail = "Image too large"
    default_code = "too_large"


class _AvatarFieldKwargs(TypedDict, total=False):
    read_only: bool
    write_only: bool
    required: bool | None
    default: _DefaultInitial[BytesIO | None]
    initial: _DefaultInitial[BytesIO | None]
    source: str | None
    label: StrOrPromise | None
    help_text: StrOrPromise | None
    style: dict[str, object] | None
    error_messages: dict[str, StrOrPromise] | None
    validators: Sequence[Validator[BytesIO | None]] | None
    allow_null: bool


class AvatarField(serializers.Field[BytesIO | None, str, str | bytes, object]):
    def __init__(
        self,
        max_size: int = settings.SENTRY_MAX_AVATAR_SIZE,
        min_dimension: int = MIN_DIMENSION,
        max_dimension: int = MAX_DIMENSION,
        is_sentry_app: bool | None = None,
        **kwargs: Unpack[_AvatarFieldKwargs],
    ) -> None:
        super().__init__(**kwargs)
        self.max_size = max_size
        self.min_dimension = min_dimension
        self.max_dimension = max_dimension
        self.is_sentry_app = is_sentry_app

    def to_representation(self, value: BytesIO | None) -> str | bytes:
        if not value:
            return ""
        return value.getvalue()

    def to_internal_value(self, data: str) -> BytesIO | None:
        if not data:
            return None
        decoded = b64decode(data)
        if len(decoded) > self.max_size:
            raise ImageTooLarge()

        with Image.open(BytesIO(decoded)) as img:
            if self.is_sentry_app and (
                img.format is None or Image.MIME[img.format] not in SENTRY_APP_ALLOWED_MIMETYPES
            ):
                valid_formats = ", ".join(SENTRY_APP_ALLOWED_MIMETYPES)
                raise serializers.ValidationError(
                    f"Invalid image format. App icons should be {valid_formats}."
                )

            if img.format is None or Image.MIME[img.format] not in ALLOWED_MIMETYPES:
                raise serializers.ValidationError("Invalid image format.")

            width, height = img.size
            if not self.is_valid_size(width, height):
                raise serializers.ValidationError("Invalid image dimensions.")

        return BytesIO(decoded)

    def is_valid_size(self, width: int, height: int) -> bool:
        if width != height:
            return False
        if width < self.min_dimension:
            return False
        if width > self.max_dimension:
            return False
        return True
