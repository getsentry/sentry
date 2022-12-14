from uuid import uuid4

from django.core.files.base import File as FileObj

from sentry import options
from sentry.models.file import ChunkedFileBlobIndexWrapper


def get_chunked_blob_from_indexes(file_blob_indexes):
    chunked_file_index_wrapper = ChunkedFileBlobIndexWrapper(
        file_blob_indexes,
        mode=None,
        prefetch=True,
        prefetch_to=None,
        delete=True,
    )
    return FileObj(chunked_file_index_wrapper, uuid4().hex)


def replays_storage_options():
    backend = options.get("replays.storage.backend")
    opts = options.get("replays.storage.options")

    # No custom storage driver configured, let get_storage fallback to default
    if not backend:
        return None

    return {"backend": backend, "options": opts}
