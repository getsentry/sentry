from unittest.mock import patch

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.read import (
    download_file_part,
    find_file_part_by_key,
    find_file_parts_by_keys,
    find_file_parts_by_prefix,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_find_file_parts_by_prefix():
    file_part = FilePartModel.objects.create(
        end=0, filename="a", is_archived=False, key="aa", start=0
    )

    parts = find_file_parts_by_prefix("a", limit=2, offset=0)
    assert len(parts) == 1
    assert parts[0].key == file_part.key
    assert parts[0].is_archived is False


@django_db_all
def test_find_file_parts_by_prefix_is_archived():
    FilePartModel.objects.create(end=0, filename="a", is_archived=True, key="aa", start=0)
    parts = find_file_parts_by_prefix("a", limit=2, offset=0)
    assert len(parts) == 0


@django_db_all
def test_find_file_parts_by_keys():
    file_part = FilePartModel.objects.create(
        end=0, filename="a", is_archived=False, key="aa", start=0
    )

    parts = find_file_parts_by_keys(["aa", "ab"])
    assert len(parts) == 1
    assert parts[0].key == file_part.key
    assert parts[0].is_archived is False


@django_db_all
def test_find_file_parts_by_keys_is_archived():
    FilePartModel.objects.create(end=0, filename="a", is_archived=True, key="aa", start=0)
    parts = find_file_parts_by_keys(["aa", "ab"])
    assert len(parts) == 0


@django_db_all
def test_find_file_part_by_key():
    file_part = FilePartModel.objects.create(
        end=0, filename="a", is_archived=False, key="aa", start=0
    )

    part = find_file_part_by_key("aa")
    assert part is not None
    assert part.key == file_part.key
    assert part.is_archived is False


@django_db_all
def test_find_file_part_by_key_is_archived():
    FilePartModel.objects.create(end=0, filename="a", is_archived=True, key="aa", start=0)
    part = find_file_part_by_key("aa")
    assert part is None


@patch("sentry.replays.lib.batched_file_storage.read.download_blob_range")
@django_db_all
def test_fetch_file_part_blob_data(download_blob_range):
    download_blob_range.return_value = b"Hello, world!"

    file_part = FilePartModel.objects.create(
        end=0, filename="a", is_archived=False, key="a", start=0
    )
    blob_data = download_file_part(file_part)
    assert blob_data == b"Hello, world!"
