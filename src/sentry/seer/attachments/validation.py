from __future__ import annotations

import warnings
from io import BytesIO
from pathlib import PurePath

from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from sentry.seer.attachments.models import (
    Attachment,
    AttachmentError,
    limit,
    observe,
    sanitize_filename,
)


def validate_upload(upload: UploadedFile) -> tuple[bytes, Attachment]:
    with observe("validation"):
        maximum = max(limit("max-image-bytes"), limit("max-pdf-bytes"), limit("max-text-bytes"))
        if upload.size is not None and upload.size > maximum:
            raise AttachmentError(
                "file_too_large", "The attachment exceeds the file size limit.", 413
            )
        data = upload.read(maximum + 1)
        if len(data) > maximum:
            raise AttachmentError(
                "file_too_large", "The attachment exceeds the file size limit.", 413
            )
        if not data:
            raise AttachmentError("empty_file", "Empty attachments are not supported.")
        filename = sanitize_filename(upload.name or "attachment")
        attachment: Attachment | None
        if data.startswith(b"%PDF-"):
            attachment = validate_pdf(data, filename)
        else:
            attachment = validate_image(data, filename)
            if attachment is None:
                extension = PurePath(filename).suffix.lower()
                if extension not in (".json", ".md", ".markdown"):
                    raise AttachmentError(
                        "unsupported_type",
                        "Supported attachments are JPEG, PNG, WebP, PDF, JSON, and Markdown.",
                    )
                attachment = Attachment(
                    filename,
                    "application/json" if extension == ".json" else "text/markdown",
                    len(data),
                    "json" if extension == ".json" else "markdown",
                )
                attachment.check_limits()
                try:
                    data.decode("utf-8")
                except UnicodeDecodeError as exc:
                    raise AttachmentError(
                        "invalid_utf8", "Text attachments must use UTF-8."
                    ) from exc
        attachment.check_limits()
        return data, attachment


def validate_image(data: bytes, filename: str) -> Attachment | None:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if image.format not in ("JPEG", "PNG", "WEBP"):
                    raise AttachmentError("unsupported_type", "This image format is not supported.")
                if getattr(image, "n_frames", 1) != 1:
                    raise AttachmentError("animated_image", "Animated images are not supported.")
                attachment = Attachment(
                    filename,
                    Image.MIME[image.format],
                    len(data),
                    "image",
                    image.width,
                    image.height,
                )
                attachment.check_limits()
                image.verify()
            # verify checks file structure; load also requires complete pixel data.
            with Image.open(BytesIO(data)) as image:
                image.load()
            return attachment
    except UnidentifiedImageError:
        # Do not reinterpret an identifiable but corrupt image as a text file.
        if data.startswith((b"\xff\xd8", b"\x89PNG", b"RIFF", b"GIF8")):
            raise AttachmentError("invalid_image", "The image cannot be decoded.")
        return None
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise AttachmentError("image_too_large", "The image exceeds the pixel limit.", 413) from exc
    except (OSError, ValueError, SyntaxError) as exc:
        raise AttachmentError("invalid_image", "The image cannot be decoded.") from exc


def validate_pdf(data: bytes, filename: str) -> Attachment:
    if len(data) > limit("max-pdf-bytes"):
        raise AttachmentError("file_too_large", "The attachment exceeds the file size limit.", 413)
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise AttachmentError("encrypted_pdf", "Encrypted PDFs are not supported.")
        pages = len(reader.pages)
    except (PyPdfError, ValueError, TypeError, KeyError, IndexError, RecursionError) as exc:
        raise AttachmentError("invalid_pdf", "The PDF cannot be parsed.") from exc
    return Attachment(filename, "application/pdf", len(data), "pdf", page_count=pages)
