from __future__ import absolute_import

# from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from sentry import options
from sentry.models import FileBlob
from sentry.models.file import DEFAULT_BLOB_SIZE
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectReleasePermission


MAX_CHUNKS_PER_REQUEST = 16
MAX_CONCURRENCY = 4
HASH_ALGORITHM = 'sha1'


class ChunkUploadEndpoint(Endpoint):
    permission_classes = (ProjectReleasePermission, )

    def get(self, request):
        endpoint = options.get('system.upload-url-prefix')
        # We fallback to default system url if config is not set
        if len(endpoint) == 0:
            endpoint = options.get('system.url-prefix')

        return Response(
            {
                'url': endpoint,
                'chunkSize': DEFAULT_BLOB_SIZE,
                'chunksPerRequest': MAX_CHUNKS_PER_REQUEST,
                'concurrency': MAX_CONCURRENCY,
                'hashAlgorithm': HASH_ALGORITHM,
            }
        )

    def post(self, request):
        files = request.FILES.getlist('file')

        if len(files) > MAX_CHUNKS_PER_REQUEST:
            return Response({'error': 'Too many chunks'},
                            status=status.HTTP_400_BAD_REQUEST)
        elif len(files) == 0:
            # No files uploaded is ok
            return Response(status=status.HTTP_200_OK)

        # Validate file size
        checksum_list = []
        for chunk in files:
            if chunk._size > DEFAULT_BLOB_SIZE:
                return Response({'error': 'Chunk size too large'},
                                status=status.HTTP_400_BAD_REQUEST)
            checksum_list.append(chunk._name)

        for chunk in files:
            # Here we create the actual file
            blob = FileBlob.from_file(chunk)
            if blob.checksum not in checksum_list:
                # We do not clean up here since we have a cleanup job
                return Response({'error': 'Checksum missmatch'},
                                status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)
