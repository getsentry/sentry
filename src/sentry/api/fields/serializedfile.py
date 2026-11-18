from __future__ import annotations

from base64 import b64decode, b64encode
from collections.abc import Sequence
from dataclasses import dataclass
from io import BytesIO
from typing import TYPE_CHECKING, TypedDict, Unpack, cast

from django.conf import settings
from rest_framework import serializers

from sentry.api.exceptions import SentryAPIException

if TYPE_CHECKING:
    from django_stubs_ext import StrOrPromise
    from rest_framework.fields import _DefaultInitial
    from rest_framework.validators import Validator


@dataclass
class FileUpload:
    name: str
    content: BytesIO


class FileTooLarge(SentryAPIException):
    status_code = 413
    default_detail = "File too large"
    default_code = "too_large"


class _SerializedFileFieldKwargs(TypedDict, total=False):
    read_only: bool
    write_only: bool
    required: bool | None
    default: _DefaultInitial[FileUpload | None]
    initial: _DefaultInitial[FileUpload | None]
    source: str | None
    label: StrOrPromise | None
    help_text: StrOrPromise | None
    style: dict[str, object] | None
    error_messages: dict[str, StrOrPromise] | None
    validators: Sequence[Validator[FileUpload | None]] | None
    allow_null: bool


class SerializedFileField(
    serializers.Field[FileUpload | None, Sequence[str | bytes] | None, str | list[str], object]
):
    def __init__(
        self,
        max_size: int = settings.SENTRY_MAX_SERIALIZED_FILE_SIZE,
        **kwargs: Unpack[_SerializedFileFieldKwargs],
    ) -> None:
        super().__init__(**kwargs)
        self.max_size = max_size

    def to_representation(self, value: FileUpload | None) -> str | list[str]:
        if not value:
            return ""
        if not isinstance(value, FileUpload):
            raise ValueError
        return [value.name, b64encode(value.content.getvalue()).decode("utf-8")]

    def to_internal_value(self, data: Sequence[str | bytes] | None) -> FileUpload | None:
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

        return FileUpload(name=cast(str, filename), content=BytesIO(decodedcontent))
