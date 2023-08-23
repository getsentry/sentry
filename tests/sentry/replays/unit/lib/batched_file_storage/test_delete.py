import io
from unittest.mock import patch

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.delete import (
    archive_file_part,
    archive_file_parts,
    delete_and_zero_file_part,
    zero_bytes_in_range,
)
from sentry.testutils.pytest.fixtures import django_db_all


def test_zero_bytes_in_range():
    """Test "zero_bytes_in_range" function."""
    blob = io.BytesIO(b"Hello, world!")
    zero_bytes_in_range(blob, start=5, length=3)
    assert blob.read() == b"Hello\x00\x00\x00orld!"


@django_db_all
def test_archive_file_parts():
    file_part = FilePartModel.objects.create(
        end=8, filename="a", is_archived=False, key="a", start=5
    )
    archive_file_parts([file_part])
    assert file_part.is_archived


@django_db_all
def test_archive_file_part():
    file_part = FilePartModel.objects.create(
        end=8, filename="a", is_archived=False, key="a", start=5
    )
    archive_file_part(file_part)
    assert file_part.is_archived


@patch("sentry.replays.lib.batched_file_storage.delete.download_blob")
@patch("sentry.replays.lib.batched_file_storage.delete.upload_blob")
@django_db_all
def test_delete_and_zero_file_part(upload_blob, download_blob):
    """Test "delete_and_zero_file_part" function."""
    download_blob.return_value = b"Hello, world!"
    upload_blob.return_value = None

    file_part = FilePartModel.objects.create(
        end=8, filename="a", is_archived=True, key="a", start=5
    )

    delete_and_zero_file_part(file_part)

    # Assert file-part was deleted.
    assert FilePartModel.objects.first() is None
