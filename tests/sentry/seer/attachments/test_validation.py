from io import BytesIO
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from sentry.seer.attachments.models import (
    Attachment,
    AttachmentError,
    AttachmentKind,
    sanitize_filename,
)
from sentry.seer.attachments.validation import validate_upload

pytestmark = pytest.mark.django_db


def image_bytes(format: str = "PNG", size: tuple[int, int] = (2, 3), **kwargs: Any) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, "red").save(output, format=format, **kwargs)
    return output.getvalue()


@pytest.mark.parametrize(
    "format,mime", [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]
)
def test_images_identified_by_bytes(format: str, mime: str) -> None:
    data = image_bytes(format)
    original, metadata = validate_upload(SimpleUploadedFile("wrong.pdf", data, "text/plain"))
    assert original == data
    assert metadata == Attachment("wrong.pdf", mime, len(data), "image")


@pytest.mark.parametrize(
    "filename,kind",
    [("DATA.JSON", "json"), ("notes.MD", "markdown"), ("notes.Markdown", "markdown")],
)
def test_text_ignores_mime_and_preserves_invalid_json(filename: str, kind: AttachmentKind) -> None:
    data = b'{not json: "\xc3\xa9"'
    original, metadata = validate_upload(
        SimpleUploadedFile(filename, data, "application/octet-stream")
    )
    assert original == data
    assert metadata.kind == kind


@pytest.mark.parametrize(
    "name,data,code",
    [
        ("empty.md", b"", "empty_file"),
        ("bad.json", b"\xff", "invalid_utf8"),
        ("file.txt", b"hello", "unsupported_type"),
        ("fake.pdf", b"not a PDF", "unsupported_type"),
        ("fake.webp", b"RIFF\x00\x00\x00\x00WAVE", "unsupported_type"),
        ("image.gif", image_bytes("GIF"), "unsupported_type"),
    ],
)
def test_rejected_files(name: str, data: bytes, code: str) -> None:
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile(name, data))
    assert exc.value.code == code


@pytest.mark.parametrize(
    "data",
    [
        image_bytes(size=(8001, 1)),
        image_bytes("PNG", save_all=True, append_images=[Image.new("RGB", (2, 3), "blue")]),
        image_bytes("WEBP", save_all=True, append_images=[Image.new("RGB", (2, 3), "blue")]),
    ],
)
def test_image_dimensions_and_frames_are_not_restricted(data: bytes) -> None:
    assert validate_upload(SimpleUploadedFile("image", data))[0] == data


def test_pdf_signature_without_parsing() -> None:
    data = b"%PDF-1.7\nContents are not parsed."
    original, attachment = validate_upload(SimpleUploadedFile("wrong.bin", data, "image/jpeg"))
    assert original == data
    assert attachment == Attachment("wrong.bin", "application/pdf", len(data), "pdf")


def test_filename_sanitization() -> None:
    assert sanitize_filename("../folder\\evil\r\n\x00\u202ename.md") == "evilname.md"
    assert sanitize_filename("x" * 256) == "x" * 255
    assert sanitize_filename("../") == "attachment"


@pytest.mark.parametrize(
    "filename,data,maximum",
    [
        ("file.md", b"text", 100 * 1024),
        ("file.png", image_bytes(), 3 * 1024 * 1024),
        ("file.pdf", b"%PDF-1.7\n", 10 * 1024 * 1024),
    ],
)
def test_file_byte_boundaries(filename: str, data: bytes, maximum: int) -> None:
    original = data.ljust(maximum, b" ")
    assert validate_upload(SimpleUploadedFile(filename, original))[0] == original
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile(filename, original + b" "))
    assert exc.value.status_code == 413
