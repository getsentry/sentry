from __future__ import absolute_import

from itertools import izip
from rest_framework import status
from six.moves.urllib.parse import urljoin
from rest_framework.response import Response
from django.core.urlresolvers import reverse
from django.conf import settings
from django.db import IntegrityError, transaction

from sentry import options
from sentry.models import FileBlob, FileBlobOwner
from sentry.models.file import DEFAULT_BLOB_SIZE
from sentry.api.bases.organization import (OrganizationEndpoint,
                                           OrganizationReleasePermission)


MAX_CHUNKS_PER_REQUEST = 64
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = settings.DEBUG and 1 or 4
HASH_ALGORITHM = 'sha1'


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
                'chunkSize': DEFAULT_BLOB_SIZE,
                'chunksPerRequest': MAX_CHUNKS_PER_REQUEST,
                'maxRequestSize': MAX_REQUEST_SIZE,
                'concurrency': MAX_CONCURRENCY,
                'hashAlgorithm': HASH_ALGORITHM,
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
        if len(files) == 0:
            # No files uploaded is ok
            return Response(status=status.HTTP_200_OK)

        # Validate file size
        checksums = []
        size = 0
        for chunk in files:
            size += chunk._size
            if chunk._size > DEFAULT_BLOB_SIZE:
                return Response({'error': 'Chunk size too large'},
                                status=status.HTTP_400_BAD_REQUEST)
            checksums.append(chunk._name)

        if size > MAX_REQUEST_SIZE:
            return Response({'error': 'Request too large'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(files) > MAX_CHUNKS_PER_REQUEST:
            return Response({'error': 'Too many chunks'},
                            status=status.HTTP_400_BAD_REQUEST)

        for checksum, chunk in izip(checksums, files):
            # Here we create the actual blob
            blob = FileBlob.from_file(chunk)
            # Add ownership to the blob here
            try:
                with transaction.atomic():
                    FileBlobOwner.objects.create(
                        organization=organization,
                        blob=blob
                    )
            except IntegrityError:
                pass
            if blob.checksum != checksum:
                # We do not clean up here since we have a cleanup job
                return Response({'error': 'Checksum missmatch'},
                                status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)
