from __future__ import annotations

import base64

from django.conf import settings

from sentry.models import FilePartModel
from sentry.replays.lib.batched_file_storage.storage import read_range
from sentry.utils.crypt_envelope import envelope_decrypt


def find_file_parts_by_prefix(key_prefix: str, limit: int, offset: int) -> list[FilePartModel]:
    """Return a list of file-parts."""
    return FilePartModel.objects.filter(is_archived=False, key__startswith=key_prefix).all()[
        offset : limit + offset
    ]


def find_file_part(key: str) -> FilePartModel | None:
    """Return a file-part instance if it can be found."""
    return FilePartModel.objects.filter(is_archived=False, key=key).first()


def fetch_file_part_blob_data(file_part: FilePartModel) -> bytes:
    result = read_range(file_part.filename, file_part.start, file_part.end)

    # File-parts are optionally encrypted.  If we encounter a file-part model with a non-null
    # value in the `dek` column we know the value was encrypted.
    if file_part.dek:
        kek = settings.REPLAYS_KEK
        dek = base64.b64decode(file_part.dek)
        return envelope_decrypt(kek, dek, result)
    else:
        return result
