from __future__ import annotations

from collections.abc import Sequence
from io import BytesIO
from typing import IO, Literal

import zstandard

from sentry.models.files.utils import get_storage
from sentry.storage.metrics import measure_storage_put
from sentry.utils import metrics

Usecases = Literal["attachments"]
Compression = Literal["zstd", "internal"]

ATTACHMENTS_PREFIX = "eventattachments/v1/"


class StorageService:
    def __init__(self, usecase: Usecases):
        self.usecase = usecase

    def for_organization(self, organization_id: int) -> StorageClient:
        return StorageClient(self.usecase)

    def for_project(self, project_id: int) -> StorageClient:
        return StorageClient(self.usecase)


class StorageClient:
    def __init__(self, usecase: Usecases):
        self.usecase = usecase

    def put(
        self,
        contents: bytes | IO[bytes],
        id: str | None = None,
        is_compressed: Compression | None = None,
    ) -> str:
        """
        Uploads the given `contents` to blob storage.

        If no `id` is provided, one will be automatically generated and returned
        from this function.

        The storage service will manage storing the contents compressed, unless
        the `is_compressed` parameter is set, in which case the contents are treated
        as already compressed, and no double-compression will happen.

        The `"internal"` compression is special in the sense that it denotes
        a file format that is already compressed, and does not need to be
        re-compressed with a general-purpose compression algorithm.
        """
        if self.usecase != "attachments":
            raise NotImplementedError(
                "The new blobstore is only implemented for attachments right now."
            )
        id = _ensure_id(id)
        upload_id = ATTACHMENTS_PREFIX + id

        if is_compressed:
            raise NotImplementedError("The `is_compressed` parameter is not yet implemented")

        if not isinstance(contents, bytes):
            contents = contents.read()

        metrics.distribution(
            "storage.put.size",
            len(contents),
            tags={"usecase": self.usecase, "compression": "none"},
            unit="byte",
        )

        with measure_storage_put(None, self.usecase, "zstd") as measurement:
            storage = get_storage()
            # TODO: the existing "Go filestore" backend expects a seekable/rewind-able
            # IO instance, as it calculates a crc value before actually performing the upload.
            # This pretty much means we can't use streaming compression here,
            # and have to perform bulk compression in memory.
            compressed_blob = zstandard.compress(contents)
            measurement.upload_size = len(compressed_blob)
            storage.save(upload_id, BytesIO(compressed_blob))

        return id

    def get(
        self, id: str, accept_compression: Sequence[Compression] | None = None
    ) -> tuple[IO[bytes], Compression | None]:
        """
        This fetches the blob with the given `id`, returning an `IO` stream that
        can be read.

        Depending on the `accept_compression` parameter, the contents might be
        in compressed form, matching one of the given compression algorithms.
        The appropriate compression of the final stream is given as the second
        output.

        If the `accept_compression` parameter is missing, or it does not match
        the blobs compression as stored, it will be decompressed on the fly,
        and `None` will be returned as compression.
        """
        if self.usecase != "attachments":
            raise NotImplementedError(
                "The new blobstore is only implemented for attachments right now."
            )
        id = ATTACHMENTS_PREFIX + id

        storage = get_storage()
        compressed_blob = storage.open(id)

        if accept_compression and "zstd" in accept_compression:
            return compressed_blob, "zstd"

        dctx = zstandard.ZstdDecompressor()
        return dctx.stream_reader(compressed_blob, read_across_frames=True), None

    def delete(self, id: str):
        """
        Deletes the blob with the given `id`.
        """
        if self.usecase != "attachments":
            raise NotImplementedError(
                "The new blobstore is only implemented for attachments right now."
            )
        id = ATTACHMENTS_PREFIX + id

        storage = get_storage()
        storage.delete(id)


def _ensure_id(id: str | None) -> str:
    if id:
        return id

    from sentry.models.files import FileBlob

    return FileBlob.generate_unique_path()
