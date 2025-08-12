from __future__ import annotations

from io import BytesIO
from typing import IO, Literal, NamedTuple, NotRequired, Self, TypedDict, cast

import urllib3
import zstandard
from django.utils import timezone
from urllib3.connectionpool import HTTPConnectionPool

from sentry.objectstore.metadata import (
    HEADER_EXPIRATION,
    HEADER_META_PREFIX,
    Compression,
    ExpirationPolicy,
    Metadata,
    format_expiration,
)
from sentry.objectstore.metrics import measure_storage_operation
from sentry.utils import jwt

Permission = Literal["read", "write"]

JWT_VALIDITY_SECS = 30


class Scope(TypedDict):
    organization: int
    project: NotRequired[int]


class GetResult(NamedTuple):
    metadata: Metadata
    payload: IO[bytes]


class ClientBuilder:
    def __init__(self, usecase: str, options: dict | None = None):
        self._usecase = usecase
        self._options = options
        self._default_compression: Compression = "zstd"

    def _make_client(self, scope: Scope) -> Client:
        from sentry import options as options_store

        options = self._options or options_store.get("objectstore.config")
        pool = urllib3.connectionpool.connection_from_url(options["base_url"])
        jwt_secret = options["jwt_secret"]

        claim = {
            "usecase": self._usecase,
            "scope": scope,
        }

        return Client(pool, self._default_compression, self._usecase, claim, jwt_secret)

    def default_compression(self, default_compression: Compression) -> Self:
        self._default_compression = default_compression
        return self

    def for_organization(self, organization_id: int) -> Client:
        return self._make_client({"organization": organization_id})

    def for_project(self, organization_id: int, project_id: int) -> Client:
        return self._make_client({"organization": organization_id, "project": project_id})


class Client:
    def __init__(
        self,
        pool: HTTPConnectionPool,
        default_compression: Compression,
        usecase: str,
        claim: dict,
        jwt_secret: str,
    ):
        self._pool = pool
        self._default_compression = default_compression
        self._usecase = usecase
        self._jwt_secret = jwt_secret
        self._claim = claim

    def _make_headers(self, permission: Permission) -> dict:
        now = int(timezone.now().timestamp())
        exp = now + JWT_VALIDITY_SECS
        claims = {
            "iat": now,
            "exp": exp,
            **self._claim,
            "permissions": [permission],
        }

        authorization = jwt.encode(claims, self._jwt_secret)
        return {"Authorization": authorization}

    def put(
        self,
        contents: bytes | IO[bytes],
        id: str | None = None,
        compression: Compression | Literal["none"] | None = None,
        metadata: dict[str, str] | None = None,
        expiration_policy: ExpirationPolicy | None = None,
    ) -> str:
        """
        Uploads the given `contents` to blob storage.

        If no `id` is provided, one will be automatically generated and returned
        from this function.

        The client will select the configured `default_compression` if none is given
        explicitly.
        This can be overridden by explicitly giving a `compression` argument.
        Providing `"none"` as the argument will instruct the client to not apply
        any compression to this upload, which is useful for uncompressible formats.
        """
        headers = self._make_headers("write")
        body = BytesIO(contents) if isinstance(contents, bytes) else contents
        original_body: IO[bytes] = body

        compression = compression or self._default_compression
        if compression == "zstd":
            cctx = zstandard.ZstdCompressor()
            body = cctx.stream_reader(original_body)
            headers["Content-Encoding"] = "zstd"

        if expiration_policy:
            headers[HEADER_EXPIRATION] = format_expiration(expiration_policy)

        if metadata:
            for k, v in metadata.items():
                headers[f"{HEADER_META_PREFIX}{k}"] = v

        with measure_storage_operation("put", self._usecase) as metric_emitter:
            response = self._pool.request(
                "PUT",
                f"/{id}" if id else "/",
                body=body,
                headers=headers,
                preload_content=True,
                decode_content=True,
            )
            raise_for_status(response)
            res = response.json()

            # Must do this after streaming `body` as that's what is responsible
            # for advancing the seek position in both streams
            metric_emitter.record_uncompressed_size(original_body.tell())
            if compression and compression != "none":
                metric_emitter.record_compressed_size(body.tell(), compression)
            return res["key"]

    def get(self, id: str, decompress: bool = True) -> GetResult:
        """
        This fetches the blob with the given `id`, returning an `IO` stream that
        can be read.

        By default, content that was uploaded compressed will be automatically
        decompressed, unless `decompress=True` is passed.
        """
        headers = self._make_headers("read")

        with measure_storage_operation("get", self._usecase):
            response = self._pool.request(
                "GET",
                f"/{id}",
                headers=headers,
                preload_content=False,
                decode_content=False,
            )
            raise_for_status(response)
        # OR: should I use `response.stream()`?
        stream = cast(IO[bytes], response)
        metadata = Metadata.from_headers(response.headers)

        if metadata.compression and decompress:
            if metadata.compression != "zstd":
                raise NotImplementedError(
                    "Transparent decoding of anything but `zstd` is not implemented yet"
                )

            metadata.compression = None
            dctx = zstandard.ZstdDecompressor()
            stream = dctx.stream_reader(stream, read_across_frames=True)

        return GetResult(metadata, stream)

    def delete(self, id: str):
        """
        Deletes the blob with the given `id`.
        """
        headers = self._make_headers("write")

        with measure_storage_operation("delete", self._usecase):
            response = self._pool.request(
                "DELETE",
                f"/{id}",
                headers=headers,
            )
            raise_for_status(response)


class ClientError(Exception):
    def __init__(self, message: str, status: int, response: str):
        super().__init__(message)
        self.status = status
        self.response = response


def raise_for_status(response: urllib3.BaseHTTPResponse):
    if response.status >= 400:
        res = str(response.data or response.read())
        raise ClientError(
            f"Objectstore request failed with status {response.status}", response.status, res
        )
