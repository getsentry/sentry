from __future__ import absolute_import

# from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from sentry.models import FileBlob
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectReleasePermission


UPLOAD_ENDPOINT = 'https://sentry.io'
MAX_CHUNK_SIZE = 1024 * 1024
MAX_CHUNKS_PER_REQUEST = 16
MAX_CONCURRENCY = 4
HASH_ALGORITHM = 'sha1'


class ChunkUploadEndpoint(Endpoint):
    permission_classes = (ProjectReleasePermission, )

    def get(self, request):
        return Response(
            {
                'url': UPLOAD_ENDPOINT,
                'chunkSize': MAX_CHUNK_SIZE,
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
        total_size = 0
        checksum_list = []
        for chunk in files:
            if chunk._size > MAX_CHUNK_SIZE:
                return Response({'error': 'Chunk size too big'},
                                status=status.HTTP_400_BAD_REQUEST)
            total_size += chunk._size
            checksum_list.append(chunk._name)

        if total_size > MAX_CHUNKS_PER_REQUEST * MAX_CHUNK_SIZE:
            return Response({'error': 'Total requst too big'},
                            status=status.HTTP_400_BAD_REQUEST)

        for chunk in files:
            # Here we create the actual file
            blob = FileBlob.from_file(chunk)
            if blob.checksum not in checksum_list:
                # We do not clean up here since we have a cleanup job
                return Response({'error': 'Checksum missmatch'},
                                status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)
