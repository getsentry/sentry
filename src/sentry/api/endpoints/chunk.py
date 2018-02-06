from __future__ import absolute_import

import six
import jsonschema

from rest_framework import status
from rest_framework.response import Response
from django.core.urlresolvers import reverse

from sentry import options
from sentry.utils import json
from sentry.models import File, FileBlob, FileBlobOwner
from sentry.models.file import DEFAULT_BLOB_SIZE, ChunkFileState, ChunkAssembleType
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission


MAX_CHUNKS_PER_REQUEST = 16
MAX_CONCURRENCY = 4
HASH_ALGORITHM = 'sha1'


class ChunkUploadEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

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

        return Response(
            {
                'url': '{}{}'.format(endpoint, reverse('sentry-api-0-chunk-upload', args=[organization.slug])),
                'chunkSize': DEFAULT_BLOB_SIZE,
                'chunksPerRequest': MAX_CHUNKS_PER_REQUEST,
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
            # Here we create the actual blob
            blob = FileBlob.from_file(chunk)
            # Add ownership to the blob here
            FileBlobOwner.objects.get_or_create(
                organization=organization,
                blob=blob
            )
            if blob.checksum not in checksum_list:
                # We do not clean up here since we have a cleanup job
                return Response({'error': 'Checksum missmatch'},
                                status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)


class ChunkAssembleEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def create_file_response(self, state, missing_chunks=[]):
        """
        Helper function to create response for assemble endpoint
        """
        return {
            'state': state,
            'missingChunks': missing_chunks
        }

    def post(self, request, organization):
        """
        Assmble one or multiple chunks (FileBlob) into Files
        ````````````````````````````````````````````````````

        :auth: required
        """
        schema = {
            "type": "object",
            "patternProperties": {
                "^[0-9a-f]{40}$": {
                    "type": "object",
                    "required": ["type", "name", "chunks"],
                    "properties": {
                        "type": {"type": "string"},
                        "name": {"type": "string"},
                        "params": {"type": "object"},
                        "chunks": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "additionalProperties": False
                }
            },
            "additionalProperties": False
        }

        try:
            files = json.loads(request.body)
            jsonschema.validate(files, schema)
        except jsonschema.ValidationError as e:
            return Response({'error': str(e).splitlines()[0]},
                            status=400)
        except BaseException as e:
            return Response({'error': 'Invalid json body'},
                            status=400)

        file_response = {}

        from sentry.tasks.assemble import assemble_chunks
        for checksum, file_to_assemble in six.iteritems(files):
            # If we find a file with the same checksum we return it
            try:
                file = File.objects.filter(
                    checksum=checksum
                ).select_related('blobs').get()
                all_blobs = file.blobs.all()
                owned_blobs = FileBlobOwner.objects.filter(
                    blob__in=all_blobs,
                    organization=organization
                ).all()
                if len(all_blobs) == len(owned_blobs):
                    file_response[checksum] = self.create_file_response(
                        file.headers.get('state', ChunkFileState.OK)
                    )
                    continue
            except File.DoesNotExist:
                pass

            name = file_to_assemble.get('name', None)
            type = file_to_assemble.get('type', ChunkAssembleType.GENERIC)
            params = file_to_assemble.get('params', {})
            chunks = file_to_assemble.get('chunks', [])

            # If the request does not cotain any chunks for a file
            # we return nothing since this should never happen only
            # if the client sends an invalid request
            if len(chunks) == 0:
                file_response[checksum] = self.create_file_response(
                    ChunkFileState.NOT_FOUND
                )
                continue

            # Load all FileBlobs from db
            file_blobs = FileBlob.objects.filter(
                checksum__in=chunks
            ).values_list('id', 'checksum')

            # Create a missing chunks array which we return as response
            # so the client knows which chunks to reupload
            missing_chunks = list(chunks)
            for blob in file_blobs:
                del missing_chunks[missing_chunks.index(blob[1])]

            # If we have any missing chunks at all, return it to the client
            # that we need them to assemble the file
            if len(missing_chunks) > 0:
                file_response[checksum] = self.create_file_response(
                    ChunkFileState.NOT_FOUND,
                    missing_chunks
                )
                continue

            # If we have all chunks and the file wasn't found before
            # we create a new file here with the state CREATED
            # Note that this file only exsists while the assemble tasks run
            file = File.objects.create(
                name=name,
                checksum=checksum,
                type='chunked',
                headers={'state': ChunkFileState.CREATED}
            )

            # We need to make sure the blobs are in the order in which
            # we received them from the request.
            # Otherwise it could happen that we assemble the file in the wrong order
            # and get an garbage file.
            file_blob_ids = [x[0] for x in sorted(
                file_blobs, key=lambda blob: chunks.index(blob[1])
            )]

            # Start the actual worker which does the assembling.
            # The worker decides depending on the type how to assemble it.
            assemble_chunks.apply_async(
                kwargs={
                    'type': type,
                    'params': params,
                    'file_id': file.id,
                    'file_blob_ids': file_blob_ids,
                    'checksum': checksum,
                }
            )

            file_response[checksum] = self.create_file_response(
                file.headers.get('state', ChunkFileState.CREATED),
                missing_chunks
            )

        return Response(file_response, status=200)
