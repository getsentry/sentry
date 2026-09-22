from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from time import monotonic
from typing import Literal, TypedDict

from rest_framework.exceptions import APIException

from sentry import options
from sentry.utils import metrics

VALIDATION_VERSION = "1"
AttachmentKind = Literal["image", "pdf", "json", "markdown"]
CONTENT_TYPES: dict[str, tuple[str, ...]] = {
    "image": ("image/jpeg", "image/png", "image/webp"),
    "pdf": ("application/pdf",),
    "json": ("application/json",),
    "markdown": ("text/markdown",),
}


class AttachmentResponseOptional(TypedDict, total=False):
    width: int
    height: int
    pageCount: int


class AttachmentResponse(AttachmentResponseOptional):
    key: str
    filename: str
    contentType: str
    size: int
    kind: AttachmentKind


class AttachmentError(APIException):
    def __init__(self, code: str, detail: str, status: int = 400):
        self.status_code = status
        super().__init__({"detail": detail, "code": code})
        self.code = code


def limit(name: str) -> int:
    return int(options.get(f"seer.attachments.{name}"))


def sanitize_filename(filename: str) -> str:
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return (
        "".join(c for c in basename if not unicodedata.category(c).startswith("C"))[:255]
        or "attachment"
    )


def validate_key(key: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", key):
        raise AttachmentError("invalid_key", "Attachment keys must be opaque identifiers.")
    return key


@dataclass(frozen=True)
class Attachment:
    filename: str
    content_type: str
    size: int
    kind: AttachmentKind
    width: int | None = None
    height: int | None = None
    page_count: int | None = None

    def check_limits(self) -> None:
        if self.size <= 0:
            raise AttachmentError("empty_file", "Empty attachments are not supported.")
        size_limit = (
            limit(f"max-{self.kind}-bytes")
            if self.kind in ("image", "pdf")
            else limit("max-text-bytes")
        )
        if self.size > size_limit:
            raise AttachmentError(
                "file_too_large", "The attachment exceeds the file size limit.", 413
            )
        if self.kind == "image":
            if not self.width or not self.height or min(self.width, self.height) < 1:
                raise AttachmentError("invalid_image", "The image dimensions are invalid.")
            if max(self.width, self.height) > limit(
                "max-image-dimension"
            ) or self.width * self.height > limit("max-image-pixels"):
                raise AttachmentError(
                    "image_too_large", "The image exceeds the dimension or pixel limit.", 413
                )
        if self.kind == "pdf":
            if self.page_count is None or self.page_count < 1:
                raise AttachmentError("invalid_pdf", "The PDF must contain at least one page.")
            if self.page_count > limit("max-pdf-pages"):
                raise AttachmentError("too_many_pages", "The PDF exceeds the page limit.", 413)

    def custom_metadata(self) -> dict[str, str]:
        result = {"validation_version": VALIDATION_VERSION, "kind": self.kind}
        if self.width is not None:
            result["width"] = str(self.width)
        if self.height is not None:
            result["height"] = str(self.height)
        if self.page_count is not None:
            result["page_count"] = str(self.page_count)
        return result

    def response(self, key: str) -> AttachmentResponse:
        result: AttachmentResponse = {
            "key": key,
            "filename": self.filename,
            "contentType": self.content_type,
            "size": self.size,
            "kind": self.kind,
        }
        if self.width is not None:
            result["width"] = self.width
        if self.height is not None:
            result["height"] = self.height
        if self.page_count is not None:
            result["pageCount"] = self.page_count
        return result


@contextmanager
def observe(operation: Literal["validation", "scan", "storage", "preview"]) -> Iterator[None]:
    start = monotonic()
    outcome = "success"
    try:
        yield
    except AttachmentError as exc:
        outcome = "unavailable" if exc.status_code == 503 else "rejected"
        raise
    except Exception:
        outcome = "error"
        raise
    finally:
        tags = {"operation": operation, "outcome": outcome}
        metrics.incr("seer.attachments.operations", tags=tags)
        metrics.distribution(
            "seer.attachments.duration", monotonic() - start, unit="second", tags=tags
        )
