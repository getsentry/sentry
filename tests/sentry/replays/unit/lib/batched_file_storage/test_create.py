from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.create import (
    FilePart,
    RawFilePart,
    create_new_batch,
    process_raw_file_part,
)
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_create_new_batch():
    """Test "create_new_batch" function."""
    first: FilePart = {
        "dek": "a",
        "message": b"hello",
        "key": "a",
    }

    second: FilePart = {
        "dek": "b",
        "message": b"world",
        "key": "b",
    }

    create_new_batch([first, second])

    file_parts = FilePartModel.objects.all()

    # Assert the basic structure of the batched commit is present.
    assert len(file_parts) == 2
    assert file_parts[0].filename is not None

    # Assert non-overlapping ranges of bytes.
    assert file_parts[0].start == 0
    assert file_parts[1].start == 5
    assert file_parts[0].end == 4
    assert file_parts[1].end == 9


def test_process_raw_file_part():
    """Test "process_raw_file_part" function."""
    file_part: RawFilePart = {"key": "a", "message": b"Hello, world!"}

    processed_segment = process_raw_file_part(file_part)
    assert isinstance(processed_segment["dek"], str)
    assert isinstance(processed_segment["message"], bytes)
    assert processed_segment["key"] == "a"
