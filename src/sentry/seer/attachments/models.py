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


class AttachmentResponse(TypedDict):
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

    def custom_metadata(self) -> dict[str, str]:
        return {"validation_version": VALIDATION_VERSION, "kind": self.kind}

    def response(self, key: str) -> AttachmentResponse:
        return {
            "key": key,
            "filename": self.filename,
            "contentType": self.content_type,
            "size": self.size,
            "kind": self.kind,
        }


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
