import logging
import re
from gzip import GzipFile
from io import BytesIO

from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.api.utils import generate_region_url
from sentry.models.files.fileblob import FileBlob
from sentry.ratelimits.config import RateLimitConfig
from sentry.utils.files import get_max_file_size
from sentry.utils.http import absolute_uri

MAX_CHUNKS_PER_REQUEST = 64
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = settings.DEBUG and 1 or 8
HASH_ALGORITHM = "sha1"
SENTRYCLI_SEMVER_RE = re.compile(r"^sentry-cli\/(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)")
API_PREFIX = "/api/0"
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
)


class GzipChunk(BytesIO):
    def __init__(self, file):
        data = GzipFile(fileobj=file, mode="rb").read()
        self.size = len(data)
        self.name = file.name
        super().__init__(data)


@region_silo_endpoint
class ChunkUploadEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.OWNERS_INGEST
    permission_classes = (OrganizationReleasePermission,)
    rate_limits = RateLimitConfig(group="CLI")

    def get(self, request: Request, organization) -> Response:
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
                url = absolute_uri(relative_url, generate_region_url())
        else:
            # If user overridden upload url prefix, we want an absolute, versioned endpoint, with user-configured prefix
            url = absolute_uri(relative_url, endpoint)

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
                "maxFileSize": get_max_file_size(organization),
                "maxRequestSize": MAX_REQUEST_SIZE,
                "concurrency": MAX_CONCURRENCY,
                "hashAlgorithm": HASH_ALGORITHM,
                "compression": ["gzip"],
                "accept": accept,
            }
        )

    def post(self, request: Request, organization) -> Response:
        """
        Upload chunks and store them as FileBlobs
        `````````````````````````````````````````

        Requests to this endpoint should use the region-specific domain
        eg. `us.sentry.io` or `de.sentry.io`

        :pparam file file: The filename should be sha1 hash of the content.
                            Also not you can add up to MAX_CHUNKS_PER_REQUEST files
                            in this request.

        :auth: required
        """
        # Create a unique instance so our logger can be decoupled from the request
        # and used in threads.
        logger = logging.getLogger("sentry.files")
        logger.info("chunkupload.start")

        files = []
        if request.FILES:
            files = request.FILES.getlist("file")
            files += [GzipChunk(chunk) for chunk in request.FILES.getlist("file_gzip")]

        if len(files) == 0:
            # No files uploaded is ok
            logger.info("chunkupload.end", extra={"status": status.HTTP_200_OK})
            return Response(status=status.HTTP_200_OK)

        logger.info("chunkupload.post.files", extra={"len": len(files)})

        # Validate file size
        checksums = []
        size = 0
        for chunk in files:
            size += chunk.size
            if chunk.size > settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE:
                logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
                return Response(
                    {"error": "Chunk size too large"}, status=status.HTTP_400_BAD_REQUEST
                )
            checksums.append(chunk.name)

        if size > MAX_REQUEST_SIZE:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": "Request too large"}, status=status.HTTP_400_BAD_REQUEST)

        if len(files) > MAX_CHUNKS_PER_REQUEST:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": "Too many chunks"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            FileBlob.from_files(zip(files, checksums), organization=organization, logger=logger)
        except OSError as err:
            logger.info("chunkupload.end", extra={"status": status.HTTP_400_BAD_REQUEST})
            return Response({"error": str(err)}, status=status.HTTP_400_BAD_REQUEST)

        logger.info("chunkupload.end", extra={"status": status.HTTP_200_OK})
        return Response(status=status.HTTP_200_OK)
