from io import BytesIO
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from pypdf import PdfWriter

from sentry.seer.attachments.models import Attachment, AttachmentError, sanitize_filename
from sentry.seer.attachments.validation import validate_upload
from sentry.testutils.helpers import override_options

pytestmark = pytest.mark.django_db


def image_bytes(format="PNG", size=(2, 3), **kwargs):
    output = BytesIO()
    Image.new("RGB", size, "red").save(output, format=format, **kwargs)
    return output.getvalue()


def pdf_bytes(pages=1, password=None):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=100, height=100)
    if password is not None:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize(
    "format,mime", [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]
)
def test_images_identified_by_bytes(format, mime):
    data = image_bytes(format)
    original, metadata = validate_upload(SimpleUploadedFile("wrong.pdf", data, "text/plain"))
    assert original == data
    assert metadata == Attachment("wrong.pdf", mime, len(data), "image", 2, 3)


@pytest.mark.parametrize(
    "filename,kind",
    [("DATA.JSON", "json"), ("notes.MD", "markdown"), ("notes.Markdown", "markdown")],
)
def test_text_ignores_mime_and_preserves_invalid_json(filename, kind):
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
        ("bad.md", b"%PDF-invalid", "invalid_pdf"),
        ("bad.json", b"\xff\xd8broken", "invalid_image"),
        ("bad.png", b"\x89PNGbad", "invalid_image"),
    ],
)
def test_rejected_files(name, data, code):
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile(name, data))
    assert exc.value.code == code


def test_unsupported_image():
    with pytest.raises(AttachmentError, match="not supported"):
        validate_upload(SimpleUploadedFile("image.md", image_bytes("GIF")))


@pytest.mark.parametrize("format", ["PNG", "WEBP"])
def test_animation_rejected(format):
    data = image_bytes(
        format, save_all=True, append_images=[Image.new("RGB", (2, 3), "blue")], duration=100
    )
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile("image", data))
    assert exc.value.code == "animated_image"


def test_corrupt_image_pixels():
    data = image_bytes("PNG")[:-20]
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile("broken.png", data))
    assert exc.value.code == "invalid_image"


@pytest.mark.parametrize("dimensions", [(8001, 1), (1, 8001), (5001, 4000)])
def test_dimension_limits_before_decode(dimensions):
    with patch("sentry.seer.attachments.validation.Image.open") as open_image:
        image = open_image.return_value.__enter__.return_value
        image.format = "PNG"
        image.n_frames = 1
        image.width, image.height = dimensions
        with pytest.raises(AttachmentError) as exc:
            validate_upload(SimpleUploadedFile("x.png", b"x"))
        assert exc.value.status_code == 413
        image.load.assert_not_called()
        image.verify.assert_not_called()


@pytest.mark.parametrize("dimensions", [(8000, 1), (1, 8000), (5000, 4000)])
def test_exact_dimension_boundaries(dimensions):
    Attachment("file", "image/png", 10, "image", *dimensions).check_limits()


@pytest.mark.parametrize("password", ["secret", ""])
def test_encrypted_pdf_rejected(password):
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile("file.pdf", pdf_bytes(password=password)))
    assert exc.value.code == "encrypted_pdf"


@pytest.mark.parametrize("pages", [1, 20])
def test_pdf_pages_and_originals(pages):
    data = pdf_bytes(pages)
    original, attachment = validate_upload(SimpleUploadedFile("wrong.bin", data, "image/jpeg"))
    assert original == data
    assert attachment.page_count == pages
    assert attachment.content_type == "application/pdf"


@pytest.mark.parametrize("pages,code", [(0, "invalid_pdf"), (21, "too_many_pages")])
def test_pdf_page_rejections(pages, code):
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile("file.pdf", pdf_bytes(pages)))
    assert exc.value.code == code


def test_strict_pdf():
    data = pdf_bytes().replace(b"startxref", b"brokenref")
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile("file.pdf", data))
    assert exc.value.code == "invalid_pdf"


def test_limits_are_options():
    with override_options({"seer.attachments.max-text-bytes": 2}):
        with pytest.raises(AttachmentError) as exc:
            validate_upload(SimpleUploadedFile("x.md", b"abc"))
    assert exc.value.status_code == 413


def test_filename_sanitization():
    assert sanitize_filename("../folder\\evil\r\n\x00\u202ename.md") == "evilname.md"
    assert sanitize_filename("x" * 256) == "x" * 255
    assert sanitize_filename("../") == "attachment"


@pytest.mark.parametrize(
    "filename,data,maximum",
    [
        ("file.md", b"text", 100 * 1024),
        ("file.png", image_bytes(), 3 * 1024 * 1024),
        ("file.pdf", pdf_bytes(), 10 * 1024 * 1024),
    ],
)
def test_file_byte_boundaries(filename, data, maximum):
    original = data.ljust(maximum, b" ")
    assert validate_upload(SimpleUploadedFile(filename, original))[0] == original
    with pytest.raises(AttachmentError) as exc:
        validate_upload(SimpleUploadedFile(filename, original + b" "))
    assert exc.value.status_code == 413
