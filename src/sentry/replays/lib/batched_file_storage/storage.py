"""Storage driver module.

This driver module is layered on top of the existing filestore module. Some filestore drivers do
not support ranged reads and cannot be made to support it. This module enables transparent support
for ranged reads regardless of driver type.
"""
import io

from sentry import options
from sentry.filestore.gcs import GoogleCloudStorage
from sentry.filestore.s3 import S3Boto3Storage
from sentry.models.files.utils import get_storage


def read(filename: str) -> bytes:
    storage = get_storage(_make_storage_options())
    return storage.get(filename)


def read_range(filename: str, start: int, end: int) -> bytes:
    """Return a range of bytes contained within a file."""
    storage = get_storage(_make_storage_options())

    # Some drivers support ranged reads and other's do not.  For the driver's that do no support
    # ranged read we download the full file and return a subset of bytes manually.
    if isinstance(storage, (GoogleCloudStorage, S3Boto3Storage)):
        return storage.read_range(filename, start, end)
    else:
        file_io = io.BytesIO(storage.read(filename))
        file_io.seek(start)
        return file_io.read((end - start) + 1)


def save(filename: str, file_data: io.BytesIO) -> None:
    storage = get_storage(_make_storage_options())
    storage.save(filename, file_data)


# TODO: Hard-coded for replays.
#
# Depending on how (or if) this is abstracted we may want to make this configurable. Configuration
# is not required to generalize this feature. An organization wide consumer may point to a shared
# location removing the need to abstract the configuration.
def _make_storage_options() -> dict | None:
    backend = options.get("replay.storage.backend")
    if backend:
        return {"backend": backend, "options": options.get("replay.storage.options")}
    else:
        return None
