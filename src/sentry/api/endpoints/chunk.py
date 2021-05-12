import logging
from gzip import GzipFile
from io import BytesIO
from urllib.parse import urljoin

from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response

from sentry import options
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.models import FileBlob
from sentry.utils.compat import zip
from sentry.utils.files import get_max_file_size

MAX_CHUNKS_PER_REQUEST = 64
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = settings.DEBUG and 1 or 8
HASH_ALGORITHM = "sha1"

CHUNK_UPLOAD_ACCEPT = (
    "debug_files",  # DIF assemble
    "release_files",  # Release files assemble
    "pdbs",  # PDB upload and debug id override
    "sources",  # Source artifact bundle upload
    "bcsymbolmaps",  # BCSymbolMaps and associated PLists/UuidMaps
)


class GzipChunk(BytesIO):
    def __init__(self, file):
        data = GzipFile(fileobj=file, mode="rb").read()
        self.size = len(data)
        self.name = file.name
        super().__init__(data)


class ChunkUploadEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission,)

    def get(self, request, organization):
        """
        Return chunk upload parameters
        ``````````````````````````````
        :auth: required
        """
        endpoint = options.get("system.upload-url-prefix")
        # We fallback to default system url if config is not set
        if len(endpoint) == 0:
            endpoint = options.get("system.url-prefix")

        url = reverse("sentry-api-0-chunk-upload", args=[organization.slug])
        endpoint = urljoin(endpoint.rstrip("/") + "/", url.lstrip("/"))

        return Response(
            {
                "url": endpoint,
                "chunkSize": settings.SENTRY_CHUNK_UPLOAD_BLOB_SIZE,
                "chunksPerRequest": MAX_CHUNKS_PER_REQUEST,
                "maxFileSize": get_max_file_size(organization),
                "maxRequestSize": MAX_REQUEST_SIZE,
                "concurrency": MAX_CONCURRENCY,
                "hashAlgorithm": HASH_ALGORITHM,
                "compression": ["gzip"],
                "accept": CHUNK_UPLOAD_ACCEPT,
            }
        )

    def post(self, request, organization):
        """
        Upload chunks and store them as FileBlobs
        `````````````````````````````````````````
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
        if request.data:
            files = request.data.getlist("file")
            files += [GzipChunk(chunk) for chunk in request.data.getlist("file_gzip")]

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
