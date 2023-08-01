import base64
import uuid
import zlib
from unittest.mock import patch

from django.conf import settings

from sentry.models.blob_range import BlobRangeModel
from sentry.replays.usecases.reader import download_range, find_blob_range, find_blob_ranges
from sentry.utils.crypt_envelope import envelope_encrypt
from sentry.utils.pytest.fixtures import django_db_all


@django_db_all
def test_find_blob_ranges():
    """Test "find_blob_ranges" function."""
    replay_id = uuid.uuid4().hex
    segment_id = 0

    BlobRangeModel.objects.create(
        end=10, filename="test.txt", key=f"{replay_id}{segment_id}", start=0, dek="dek"
    )

    blob_ranges = find_blob_ranges(replay_id, 1, 0)
    assert len(blob_ranges) == 1
    assert blob_ranges[0].key == f"{replay_id}0"

    blob_ranges = find_blob_ranges(replay_id, 1, 1)
    assert not blob_ranges


@django_db_all
def test_find_blob_range():
    """Test "find_blob_range" function."""
    replay_id = uuid.uuid4().hex
    segment_id = 0

    BlobRangeModel.objects.create(
        end=10, filename="test.txt", key=f"{replay_id}{segment_id}", start=0, dek="dek"
    )

    blob_range = find_blob_range(replay_id, segment_id)
    assert blob_range.key == f"{replay_id}0"


@django_db_all
def test_find_blob_range_does_not_exist():
    """Test "find_blob_range" function when the row does not exist."""
    blob_range = find_blob_range(uuid.uuid4().hex, 1)
    assert blob_range is None


@django_db_all
def test_download_range():
    """Test "download_range" function."""
    replay_id = uuid.uuid4().hex
    segment_id = 0
    payload = b"Hello, world"

    # NOTE: Payload is compressed before being encrypted.
    dek, encrypted_payload = envelope_encrypt(settings.REPLAYS_KEK, zlib.compress(payload))

    blob_range = BlobRangeModel.objects.create(
        end=11,
        filename="test.txt",
        key=f"{replay_id}{segment_id}",
        start=0,
        dek=base64.b64encode(dek).decode("utf-8"),
    )

    with patch("sentry.replays.usecases.reader.get_storage") as storage:
        storage.return_value = _MockStorage(response_value=encrypted_payload)

        # This does not assert range reading from the service driver works. It only asserts that
        # _if_ it works the function will operate normally.
        result = download_range(blob_range)
        assert result == payload


class _MockStorage:
    def __init__(self, response_value: bytes):
        self.response_value = response_value

    def read_range(self, filename: str, start: int, end: int) -> bytes:
        return self.response_value
