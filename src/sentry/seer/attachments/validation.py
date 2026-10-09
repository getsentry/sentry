from __future__ import annotations

from pathlib import PurePath

from django.core.files.uploadedfile import UploadedFile

from sentry.seer.attachments.models import (
    Attachment,
    AttachmentError,
    AttachmentKind,
    limit,
    observe,
    sanitize_filename,
)


def validate_upload(upload: UploadedFile) -> tuple[bytes, Attachment]:
    with observe("validation"):
        maximum = max(limit("max-image-bytes"), limit("max-pdf-bytes"), limit("max-text-bytes"))
        data = upload.read(maximum + 1)
        if len(data) > maximum:
            raise AttachmentError(
                "file_too_large", "The attachment exceeds the file size limit.", 413
            )
        if not data:
            raise AttachmentError("empty_file", "Empty attachments are not supported.")
        filename = sanitize_filename(upload.name or "attachment")
        extension = PurePath(filename).suffix.lower()
        kind: AttachmentKind
        # Identify binary formats by their signatures; do not parse their contents.
        if data.startswith(b"%PDF-"):
            kind, content_type = "pdf", "application/pdf"
        elif data.startswith(b"\xff\xd8\xff"):
            kind, content_type = "image", "image/jpeg"
        elif data.startswith(b"\x89PNG\r\n\x1a\n"):
            kind, content_type = "image", "image/png"
        elif data.startswith(b"RIFF") and data[8:12] == b"WEBP":
            kind, content_type = "image", "image/webp"
        elif extension in (".json", ".md", ".markdown"):
            kind, content_type = (
                ("json", "application/json")
                if extension == ".json"
                else ("markdown", "text/markdown")
            )
        else:
            raise AttachmentError(
                "unsupported_type",
                "Supported attachments are JPEG, PNG, WebP, PDF, JSON, and Markdown.",
            )
        attachment = Attachment(filename, content_type, len(data), kind)
        attachment.check_limits()
        if kind in ("json", "markdown"):
            try:
                data.decode("utf-8")
            except UnicodeDecodeError as exc:
                raise AttachmentError("invalid_utf8", "Text attachments must use UTF-8.") from exc
        return data, attachment
