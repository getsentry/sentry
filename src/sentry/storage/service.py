from __future__ import annotations

from collections.abc import Sequence
from io import BytesIO
from typing import IO, Literal, cast

import urllib3
import zstandard
from django.utils import timezone
from urllib3.connectionpool import ConnectionPool

from sentry.storage.metrics import measure_storage_put
from sentry.utils import jwt, metrics

Usecases = Literal["attachments"]
Compression = Literal["zstd", "gzip", "lz4", "uncompressible"]

JWT_VALIDITY = 30


class StorageService:
    def __init__(self, usecase: Usecases, options: dict | None = None):
        from sentry import options as options_store

        options = options or options_store.get("objectstore.config")
        self.pool = urllib3.connectionpool.connection_from_url(options["base_url"])
        self.jwt_secret = options["jwt_secret"]
        self.usecase = usecase

    def _make_client(self, scope: dict) -> StorageClient:
        claim = {
            "usecase": self.usecase,
            "scope": scope,
        }
        return StorageClient(self.usecase, claim, self.pool, self.jwt_secret)

    def for_organization(self, organization_id: int) -> StorageClient:
        return self._make_client({"organization": organization_id})

    def for_project(self, project_id: int) -> StorageClient:
        return self._make_client({"project": project_id})


class StorageClient:
    def __init__(self, usecase: Usecases, claim: dict, pool: ConnectionPool, jwt_secret: str):
        self.pool = pool
        self.jwt_secret = jwt_secret
        self.usecase = usecase
        self.claim = claim

    def _make_headers(self) -> dict:
        now = int(timezone.now().timestamp())
        exp = now + JWT_VALIDITY
        claims = {
            "iat": now,
            "exp": exp,
            **self.claim,
        }

        authorization = jwt.encode(claims, self.jwt_secret)
        return {"Authorization": authorization}

    def put(
        self,
        contents: bytes | IO[bytes],
        id: str | None = None,
        compression: Compression | None = None,
    ) -> str:
        """
        Uploads the given `contents` to blob storage.

        If no `id` is provided, one will be automatically generated and returned
        from this function.

        The storage service will manage storing the contents compressed, unless
        the `compression` parameter is set, in which case the contents are treated
        as already compressed, and no double-compression will happen.

        The `"uncompressible"` compression is special in the sense that it denotes
        a file format that is already internally compressed, and does not benefit
        from another general-purpose compression algorithm.
        """
        headers = self._make_headers()
        body = BytesIO(contents) if isinstance(contents, bytes) else contents
        original_body: IO[bytes] = body

        if not compression:
            cctx = zstandard.ZstdCompressor()
            body = cctx.stream_reader(contents)
            headers["Content-Encoding"] = "zstd"
        elif compression != "uncompressible":
            headers["Content-Encoding"] = compression

        compression_used = headers["Content-Encoding"] or "none"
        with measure_storage_put(None, self.usecase, compression_used) as measurement:
            response = self.pool.request(
                "PUT",
                f"/{id}" if id else "/",
                body=body,
                headers=headers,
                preload_content=True,
                decode_content=True,
            ).json()

            measurement.upload_size = body.tell()
            if not compression:
                metrics.distribution(
                    "storage.put.size",
                    original_body.tell(),
                    tags={"usecase": self.usecase, "compression": "none"},
                    unit="byte",
                )

            return response["key"]

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
        headers = self._make_headers()
        compression = set()
        if accept_compression:
            compression = set(accept_compression)
            headers["Accept-Encoding"] = ", ".join(compression)

        response = self.pool.request(
            "GET",
            f"/{id}",
            headers=headers,
            preload_content=False,
            decode_content=False,
        )
        # OR: should I use `response.stream()`?
        stream = cast(IO[bytes], response)

        content_encoding = response.getheader("Content-Encoding")
        if content_encoding and content_encoding not in compression:
            if content_encoding != "zstd":
                raise NotImplementedError(
                    "Transparent decoding of anything buf `zstd` is not implemented yet"
                )

            dctx = zstandard.ZstdDecompressor()
            return dctx.stream_reader(stream, read_across_frames=True), None

        return stream, cast(Compression, content_encoding)

    def delete(self, id: str):
        """
        Deletes the blob with the given `id`.
        """
        headers = self._make_headers()

        self.pool.request(
            "DELETE",
            f"/{id}",
            headers=headers,
        )
