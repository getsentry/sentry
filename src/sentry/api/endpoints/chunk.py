from __future__ import absolute_import

import six
import jsonschema

# from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from sentry import options
from sentry.utils import json
from sentry.models import File, FileBlob
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


class ChunkAssembleEndpoint(Endpoint):
    permission_classes = (ProjectReleasePermission, )

    def post(self, request):
        schema = {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "required": ["type", "name", "chunks"],
                "properties": {
                    "type": {"type": "string"},
                    "name": {"type": "string"},
                    "chunks": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                },
                "additionalProperties": False
            }
        }

        try:
            files = json.loads(request.body)
            jsonschema.validate(files, schema)
        except jsonschema.ValidationError as e:
            return Response({'error': str(e).splitlines()[0]},
                            status=400)
        except BaseException as e:
            return Response({'error': 'invalid body data'},
                            status=400)

        file_response = {}

        from sentry.tasks.assemble import dif_chunks
        for checksum, file_to_assemble in six.iteritems(files):
            try:
                file = File.objects.filter(
                    checksum=checksum
                ).get()
                file_response[checksum] = {
                    'state': file.headers.get('state', 'OK'),
                    'missingChunks': []
                }
                continue
            except File.DoesNotExist:
                pass

            chunks = file_to_assemble.get('chunks', [])

            if len(chunks) == 0:
                file_response[checksum] = {
                    'state': 'NOT_FOUND',
                    'missingChunks': []
                }
                continue

            file_blobs = FileBlob.objects.filter(
                checksum__in=chunks
            ).values_list('id', 'checksum')

            missing_chunks = list(chunks)
            for blob in file_blobs:
                del missing_chunks[missing_chunks.index(blob[1])]

            if len(missing_chunks) > 0:
                file_response[checksum] = {
                    'state': 'NOT_FOUND',
                    'missingChunks': missing_chunks
                }
                continue

            file = File.objects.create(
                name=file_to_assemble.get('name', ''),
                checksum=checksum,
                type='chunked',
                headers={'state': 'CREATED'}
            )

            # We need to make sure the blobs are in the order in which
            # we received them from the request.
            file_blob_ids = [x[0] for x in sorted(
                file_blobs, key=lambda blob: chunks.index(blob[1])
            )]

            if file.headers.get('state') == 'CREATED':
                # Start the actual worker which does the assembling.
                dif_chunks.delay(
                    file_id=file.id,
                    file_blob_ids=file_blob_ids,
                    checksum=checksum,
                )

            file_response[checksum] = {
                'state': file.headers.get('state', 'CREATED'),
                'missingChunks': missing_chunks
            }

        return Response(file_response, status=200)
