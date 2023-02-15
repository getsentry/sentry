from uuid import uuid4

from django.core.files.base import File as FileObj

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
