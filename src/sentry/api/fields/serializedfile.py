from base64 import b64decode, b64encode
from dataclasses import dataclass
from io import BytesIO

from django.conf import settings
from rest_framework import serializers

from sentry.api.exceptions import SentryAPIException


@dataclass
class FileUpload:
    name: str
    content: BytesIO


class FileTooLarge(SentryAPIException):
    status_code = 413
    default_detail = "File too large"
    default_code = "too_large"


class SerializedFileField(serializers.Field):
    def __init__(
        self,
        max_size=settings.SENTRY_MAX_SERIALIZED_FILE_SIZE,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.max_size = max_size

    def to_representation(self, value):
        if not value:
            return ""
        if not isinstance(value, FileUpload):
            raise ValueError
        return [value.name, b64encode(value.content.getvalue()).decode("utf-8")]

    def to_internal_value(self, data):
        if not data:
            return None

        # data should be an array of [filename, b64 data]
        try:
            filename, filecontent = data
        except (ValueError, TypeError):
            raise serializers.ValidationError("Invalid file format.")

        try:
            decodedcontent = b64decode(filecontent)
        except Exception:
            raise serializers.ValidationError("Unable to read file content.")

        if self.max_size and len(data) > self.max_size:
            raise FileTooLarge()

        return FileUpload(name=filename, content=BytesIO(decodedcontent))
