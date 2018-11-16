from __future__ import absolute_import

import six
from io import BytesIO
from gzip import GzipFile
from itertools import izip
from rest_framework import status
from six.moves.urllib.parse import urljoin
from rest_framework.response import Response
from django.core.urlresolvers import reverse
from django.conf import settings

from sentry import options
from sentry.models import FileBlob
from sentry.api.bases.organization import (OrganizationEndpoint,
                                           OrganizationReleasePermission)


# The blob size must be a power of two
CHUNK_UPLOAD_BLOB_SIZE = 8 * 1024 * 1024  # 8MB
MAX_CHUNKS_PER_REQUEST = 64
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = settings.DEBUG and 1 or 4
HASH_ALGORITHM = 'sha1'


class GzipChunk(BytesIO):
    def __init__(self, file):
        data = GzipFile(fileobj=file, mode='rb').read()
        self.size = len(data)
        self.name = file.name
        super(GzipChunk, self).__init__(data)


class ChunkUploadEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission, )

    def get(self, request, organization):
        """
        Return chunk upload parameters
        ``````````````````````````````
        :auth: required
        """
        endpoint = options.get('system.upload-url-prefix')
        # We fallback to default system url if config is not set
        if len(endpoint) == 0:
            endpoint = options.get('system.url-prefix')

        url = reverse('sentry-api-0-chunk-upload', args=[organization.slug])
        endpoint = urljoin(endpoint.rstrip('/') + '/', url.lstrip('/'))

        return Response(
            {
                'url': endpoint,
                'chunkSize': CHUNK_UPLOAD_BLOB_SIZE,
                'chunksPerRequest': MAX_CHUNKS_PER_REQUEST,
                'maxRequestSize': MAX_REQUEST_SIZE,
                'concurrency': MAX_CONCURRENCY,
                'hashAlgorithm': HASH_ALGORITHM,
                'compression': ['gzip'],
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
        files = request.FILES.getlist('file')
        files += [GzipChunk(chunk) for chunk in request.FILES.getlist('file_gzip')]
        if len(files) == 0:
            # No files uploaded is ok
            return Response(status=status.HTTP_200_OK)

        # Validate file size
        checksums = []
        size = 0
        for chunk in files:
            size += chunk.size
            if chunk.size > CHUNK_UPLOAD_BLOB_SIZE:
                return Response({'error': 'Chunk size too large'},
                                status=status.HTTP_400_BAD_REQUEST)
            checksums.append(chunk.name)

        if size > MAX_REQUEST_SIZE:
            return Response({'error': 'Request too large'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(files) > MAX_CHUNKS_PER_REQUEST:
            return Response({'error': 'Too many chunks'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            FileBlob.from_files(izip(files, checksums),
                                organization=organization)
        except IOError as err:
            return Response({'error': six.text_type(err)},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)
