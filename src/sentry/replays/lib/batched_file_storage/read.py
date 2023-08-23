"""Batched file-part reader module."""
from __future__ import annotations

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import download_blob_range


def find_file_parts_by_prefix(key_prefix: str, limit: int, offset: int) -> list[FilePartModel]:
    """Return a list of file-parts."""
    return FilePartModel.objects.filter(is_archived=False, key__startswith=key_prefix).all()[
        offset : limit + offset
    ]


def find_file_parts_by_keys(keys: list[str]) -> list[FilePartModel]:
    """Return a list of file-parts."""
    return FilePartModel.objects.filter(is_archived=False, key__in=keys).all()


def find_file_part_by_key(key: str) -> FilePartModel | None:
    """Return a file-part instance if it can be found."""
    return FilePartModel.objects.filter(is_archived=False, key=key).first()


def download_file_part(file_part: FilePartModel) -> bytes:
    return download_blob_range(file_part.filename, file_part.start, file_part.end)
