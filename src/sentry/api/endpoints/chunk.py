import logging
import re
from collections.abc import Iterator
from gzip import GzipFile
from io import BytesIO
from typing import IO, Protocol

import zstandard
from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.api.utils import generate_locality_url
from sentry.models.files.fileblob import FileBlob
from sentry.models.files.utils import MAX_FILE_SIZE
from sentry.models.organization import Organization
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.ratelimits.config import RateLimitConfig
from sentry.utils.http import absolute_uri

MAX_CHUNKS_PER_REQUEST = 64
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = settings.DEBUG and 1 or 8
HASH_ALGORITHM = "sha1"
SENTRYCLI_SEMVER_RE = re.compile(r"^sentry-cli\/(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)")
API_PREFIX = "/api/0"
# IMPORTANT: All values in CHUNK_UPLOAD_ACCEPT must be maintained for backwards compatibility
# with Sentry CLI 2.x and older. Sentry CLI 3.x completely ignores the CHUNK_UPLOAD_ACCEPT
# field (starting with 3.1.0), but older CLI versions still depend on these values being
# present in the server's response. Removing any of these values would break functionality
# for CLI 2.x and older.
CHUNK_UPLOAD_ACCEPT = (
    "debug_files",  # DIF assemble
    "release_files",  # Release files assemble
    "pdbs",  # PDB upload and debug id override
    "sources",  # Source artifact bundle upload
    "bcsymbolmaps",  # BCSymbolMaps and associated PLists/UuidMaps
    "il2cpp",  # Il2cpp LineMappingJson files
    "portablepdbs",  # Portable PDB debug file
    "artifact_bundles",  # Artifact Bundles for JavaScript Source Maps
    "artifact_bundles_v2",  # The `assemble` endpoint will check for missing chunks
    "proguard",  # Chunk-uploaded proguard mappings
    "preprod_artifacts",  # Preprod artifacts (mobile builds, etc.)
    "dartsymbolmap",  # Dart/Flutter symbol mapping files
)

# Compression codecs advertised to clients via the `compression` field of the
# chunk-upload options response. Clients use this list to decide how to encode
# chunks on upload. New codecs must:
#   - be detectable via the HTTP `Content-Encoding` request header on POST, AND
#   - decompress with a hard cap of `settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE` to
#     prevent decompression bombs.
CHUNK_UPLOAD_COMPRESSION = ("gzip", "zstd")


class ChunkTooLarge(OSError):
    """Raised when a (possibly decompressed) chunk exceeds the per-chunk size limit."""


class _Reader(Protocol):
    """Minimal structural type for any bounded-read source.

    Covers the concrete types we pass in (``GzipFile`` from ``gzip`` and
    ``ZstdDecompressor().stream_reader`` from ``zstandard``) without forcing
    them to satisfy the full ``IO[bytes]`` protocol -- which they don't.
    """

    def read(self, __n: int = ...) -> bytes: ...


class _SizedChunk(Protocol):
    """A chunk we can size and name before handing it to ``FileBlob.from_files``.

    Both Django's ``UploadedFile`` (plain uploads) and our ``GzipChunk``/
    ``ZstdChunk`` wrappers expose ``.size`` and ``.name``; the underlying
    ``IO[bytes]`` type does not, which is why we need this narrower protocol.
    """

    size: int
    name: str

    def read(self, __n: int = ...) -> bytes: ...


def _read_bounded(reader: _Reader, limit: int) -> bytes:
    """Read up to ``limit`` bytes from ``reader``; raise :class:`ChunkTooLarge` if more.

    We ask for ``limit + 1`` bytes and let the stream produce as much as it can within
    that budget. If any more bytes are available after that read, the stream exceeds
    the cap and we bail. This keeps memory bounded at ``limit + 1`` bytes regardless
    of how well-compressed the input is (protects against zstd/gzip decompression
    bombs where a small compressed payload expands to hundreds of megabytes).
    """
    data = reader.read(limit + 1)
    if len(data) > limit:
        raise ChunkTooLarge("Chunk size too large")
    # Guard against streams that returned short and still have more data available
    # after a short read (shouldn't happen with BufferedReader but be defensive).
    extra = reader.read(1)
    if extra:
        raise ChunkTooLarge("Chunk size too large")
    return data


class GzipChunk(BytesIO):
    def __init__(self, file: IO[bytes]) -> None:
        reader = GzipFile(fileobj=file, mode="rb")
        data = _read_bounded(reader, settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE)
        self.size = len(data)
        self.name = getattr(file, "name", "")
        super().__init__(data)


class ZstdChunk(BytesIO):
    def __init__(self, file: IO[bytes]) -> None:
        reader = zstandard.ZstdDecompressor().stream_reader(file)
        data = _read_bounded(reader, settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE)
        self.size = len(data)
        self.name = getattr(file, "name", "")
        super().__init__(data)


class ChunkUploadPermission(OrganizationReleasePermission):
    """
    Allow OrganizationReleasePermission OR Launchpad service authentication
    """

    def _is_launchpad_authenticated(self, request: Request) -> bool:
        """Check if the request is authenticated via Launchpad service."""
        return isinstance(
            getattr(request, "successful_authenticator", None), LaunchpadRpcSignatureAuthentication
        )

    def has_permission(self, request: Request, view) -> bool:
        # Allow access for Launchpad service authentication
        if self._is_launchpad_authenticated(request):
            return True

        # Fall back to standard organization permission check
        return super().has_permission(request, view)

    def has_object_permission(self, request: Request, view, organization) -> bool:
        # Allow access for Launchpad service authentication
        if self._is_launchpad_authenticated(request):
            return True

        # Fall back to standard organization permission check
        return super().has_object_permission(request, view, organization)


@cell_silo_endpoint
class ChunkUploadEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST

    authentication_classes = OrganizationEndpoint.authentication_classes + (
        LaunchpadRpcSignatureAuthentication,
    )

    permission_classes = (ChunkUploadPermission,)
    rate_limits = RateLimitConfig(group="CLI")

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Return chunk upload parameters
        ``````````````````````````````
        :auth: required
        """
        endpoint = options.get("system.upload-url-prefix")
        relative_url = reverse("sentry-api-0-chunk-upload", args=[organization.slug])

        # Starting `sentry-cli@1.70.1` we added a support for relative chunk-uploads urls
        # User-Agent: sentry-cli/1.70.1
        user_agent = request.headers.get("User-Agent", "")
        sentrycli_version = SENTRYCLI_SEMVER_RE.search(user_agent)
        sentrycli_version_split = None
        if sentrycli_version is not None:
            sentrycli_version_split = (
                int(sentrycli_version.group("major")),
                int(sentrycli_version.group("minor")),
                int(sentrycli_version.group("patch")),
            )

        relative_urls_disabled = options.get("hybrid_cloud.disable_relative_upload_urls")
        requires_region_url = sentrycli_version_split and sentrycli_version_split >= (2, 30, 0)

        supports_relative_url = (
            not relative_urls_disabled
            and not requires_region_url
            and sentrycli_version_split
            and sentrycli_version_split >= (1, 70, 1)
        )

        # If user do not overwritten upload url prefix
        if len(endpoint) == 0:
            # And we support relative url uploads, return a relative, versionless endpoint (with `/api/0` stripped)
            if supports_relative_url:
                url = relative_url.lstrip(API_PREFIX)
            # Otherwise, if we do not support them, return an absolute, versioned endpoint with a default, system-wide prefix
            else:
                # We need to generate region specific upload URLs when possible to avoid hitting the API proxy
                # which tends to cause timeouts and performance issues for uploads.
                url = absolute_uri(relative_url, generate_locality_url())
        else:
            # If user overridden upload url prefix, we want an absolute, versioned endpoint, with user-configured prefix
            url = absolute_uri(relative_url, endpoint)

        compression: list[str] = (
            []
            if organization.id in options.get("chunk-upload.no-compression")
            else list(CHUNK_UPLOAD_COMPRESSION)
        )
        accept = CHUNK_UPLOAD_ACCEPT

        # Sentry CLI versions ≤2.39.1 require "chunkSize" to be a power of two, and will error otherwise,
        # with no way for the user to work around the error. This restriction has been removed from
        # newer Sentry CLI versions.
        # Be aware that changing "chunkSize" to something that is not a power of two will break
        # Sentry CLI ≤2.39.1.
        return Response(
            {
                "url": url,
                "chunkSize": settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE,
                "chunksPerRequest": MAX_CHUNKS_PER_REQUEST,
                "maxFileSize": MAX_FILE_SIZE,
                "maxRequestSize": MAX_REQUEST_SIZE,
                "concurrency": MAX_CONCURRENCY,
                "hashAlgorithm": HASH_ALGORITHM,
                "compression": compression,
                "accept": accept,
            }
        )

    def post(self, request: Request, organization) -> Response:
        """
        Upload chunks and store them as FileBlobs
        `````````````````````````````````````````
        Requests to this endpoint should use the region-specific domain
        eg. `us.sentry.io` or `de.sentry.io`

        Compression is negotiated via the HTTP ``Content-Encoding`` request
        header. Supported values are listed in the ``compression`` field of the
        ``GET`` response (currently ``gzip`` and ``zstd``). When set, every
        chunk delivered under the ``file`` multipart field is decoded using
        that codec.

        The legacy ``file_gzip`` multipart field is still accepted for
        backwards compatibility with older clients, but is deprecated in favor
        of ``Content-Encoding: gzip`` on the ``file`` field. Requests that mix
        ``Content-Encoding`` with a ``file_gzip`` entry are rejected with 400
        to avoid ambiguity -- clients must pick one mechanism per request.

        :pparam file file: The filename should be sha1 hash of the (decoded)
                            content. Also note you can add up to
                            MAX_CHUNKS_PER_REQUEST files in this request.

        :auth: required
        """
        # Create a unique instance so our logger can be decoupled from the request
        # and used in threads.
        logger = logging.getLogger("sentry.files")
        logger.info("chunkupload.start")

        encoding = request.headers.get("Content-Encoding", "").strip().lower()
        if encoding and encoding not in CHUNK_UPLOAD_COMPRESSION:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response(
                {"error": "Unsupported Content-Encoding"}, status=status.HTTP_400_BAD_REQUEST
            )

        files_plain = request.FILES.getlist("file")
        files_gzip_legacy = request.FILES.getlist("file_gzip")

        # Mixing the new Content-Encoding mechanism with the deprecated
        # `file_gzip` field is ambiguous: the legacy field always means gzip
        # regardless of the header, so a request with both is asking the server
        # to apply two different codecs in one upload. Reject up front.
        if encoding and files_gzip_legacy:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response(
                {"error": "Cannot combine Content-Encoding with file_gzip field"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        files: list[_SizedChunk] = []
        checksums: list[str] = []
        total_size = 0

        # Validate if chunks exceed the maximum chunk limit before attempting to decompress them.
        num_files = len(files_plain) + len(files_gzip_legacy)

        if num_files > MAX_CHUNKS_PER_REQUEST:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": "Too many chunks"}, status=status.HTTP_400_BAD_REQUEST)

        # No files uploaded is ok
        if num_files == 0:
            logger.info("chunkupload.end", extra={"status": status.HTTP_200_OK})
            return Response(status=status.HTTP_200_OK)

        try:
            for chunk, name in get_files(request, encoding):
                if chunk.size > settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE:
                    logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
                    return Response(
                        {"error": "Chunk size too large"}, status=status.HTTP_400_BAD_REQUEST
                    )

                total_size += chunk.size
                if total_size > MAX_REQUEST_SIZE:
                    logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
                    return Response(
                        {"error": "Request too large"}, status=status.HTTP_400_BAD_REQUEST
                    )

                files.append(chunk)
                checksums.append(name)
        except ChunkTooLarge:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": "Chunk size too large"}, status=status.HTTP_400_BAD_REQUEST)
        except zstandard.ZstdError:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": "Invalid zstd payload"}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("chunkupload.post.files", extra={"len": len(files)})

        try:
            FileBlob.from_files(zip(files, checksums), organization=organization, logger=logger)
        except OSError as err:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": str(err)}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("chunkupload.end", extra={"status": status.HTTP_200_OK})
        return Response(status=status.HTTP_200_OK)


def get_files(request: Request, encoding: str) -> Iterator[tuple[_SizedChunk, str]]:
    """Yield ``(chunk, checksum)`` tuples for every uploaded chunk.

    ``encoding`` is the (lowercased) value of the request's ``Content-Encoding``
    header and must be ``""``, ``"gzip"``, or ``"zstd"`` (validated by the
    caller). When non-empty, every chunk under the ``file`` multipart field is
    decoded using that codec.

    The legacy ``file_gzip`` multipart field is always decoded as gzip
    independent of the header. It is deprecated in favor of
    ``Content-Encoding: gzip`` on the ``file`` field.
    """
    for chunk in request.FILES.getlist("file"):
        if encoding == "gzip":
            yield GzipChunk(chunk), chunk.name
        elif encoding == "zstd":
            yield ZstdChunk(chunk), chunk.name
        else:
            yield chunk, chunk.name

    # Deprecated: prefer `Content-Encoding: gzip` on the `file` field. Retained
    # for backwards compatibility with older sentry-cli versions that always
    # dispatch gzipped chunks under this field name.
    for chunk in request.FILES.getlist("file_gzip"):
        yield GzipChunk(chunk), chunk.name
