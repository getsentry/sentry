from __future__ import absolute_import

import six
import jsonschema

from rest_framework import status
from six.moves.urllib.parse import urljoin
from rest_framework.response import Response
from django.core.urlresolvers import reverse
from django.db import IntegrityError, transaction

from sentry import options
from sentry.utils import json
from sentry.models import File, FileBlob, FileBlobOwner
from sentry.models.file import DEFAULT_BLOB_SIZE, ChunkFileState, ChunkAssembleType
from sentry.api.bases.organization import (OrganizationEndpoint,
                                           OrganizationReleasePermission)


MAX_CHUNKS_PER_REQUEST = 40
MAX_REQUEST_SIZE = 32 * 1024 * 1024
MAX_CONCURRENCY = 4
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
        checksum_list = []
        size = 0
        for chunk in files:
            size += chunk._size
            if chunk._size > DEFAULT_BLOB_SIZE:
                return Response({'error': 'Chunk size too large'},
                                status=status.HTTP_400_BAD_REQUEST)
            checksum_list.append(chunk._name)

        if size > MAX_REQUEST_SIZE:
            return Response({'error': 'Request too large'},
                            status=status.HTTP_400_BAD_REQUEST)

        if len(files) > MAX_CHUNKS_PER_REQUEST:
            return Response({'error': 'Too many chunks'},
                            status=status.HTTP_400_BAD_REQUEST)

        for chunk in files:
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
            if blob.checksum not in checksum_list:
                # We do not clean up here since we have a cleanup job
                return Response({'error': 'Checksum missmatch'},
                                status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_200_OK)


class ChunkAssembleEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission, )

    def _create_file_response(self, state, missing_chunks=[]):
        """
        Helper function to create response for assemble endpoint
        """
        return {
            'state': state,
            'missingChunks': missing_chunks
        }

    def _check_chunk_ownership(self, organization, file_blobs, chunks, file_exists):
        # Check the ownership of these blobs with the org
        all_owned_blobs = FileBlobOwner.objects.filter(
            blob__in=file_blobs,
            organization=organization
        ).select_related('blob').all()

        owned_blobs = []
        for owned_blob in all_owned_blobs:
            owned_blobs.append((owned_blob.blob.id, owned_blob.blob.checksum))

        # If the request does not cotain any chunks for a file
        # we return nothing since this should never happen only
        # if the client sends an invalid request
        if len(chunks) == 0:
            return self._create_file_response(
                ChunkFileState.NOT_FOUND
            )
        # Only if this org already has the ownership of all blobs
        # and the count of chunks is the same as in the request
        # and the file already exists, we say this file is OK
        elif len(file_blobs) == len(owned_blobs) == len(chunks) and file_exists:
            return self._create_file_response(
                ChunkFileState.OK
            )
        # If the length of owned and sent chunks is not the same
        # we return all missing blobs
        elif len(owned_blobs) != len(chunks):
            # Create a missing chunks array which we return as response
            # so the client knows which chunks to reupload
            missing_chunks = list(chunks)
            for blob in owned_blobs:
                if blob[1] in missing_chunks:
                    del missing_chunks[missing_chunks.index(blob[1])]
            # If we have any missing chunks at all, return it to the client
            # that we need them to assemble the file
            if len(missing_chunks) > 0:
                return self._create_file_response(
                    ChunkFileState.NOT_FOUND,
                    missing_chunks
                )

    def _check_file_blobs(self, organization, checksum, chunks):
        files = File.objects.filter(
            checksum=checksum
        ).select_related('blobs').all()
        # If there is no file at all, we try to find chunks in the db and check
        # their ownership
        if len(files) == 0:
            file_blobs = FileBlob.objects.filter(
                checksum__in=chunks
            ).all()
            return self._check_chunk_ownership(organization, file_blobs, chunks, False)
        # It is possible to have multiple files in the db because
        # we do not have a unique on the checksum
        for file in files:
            # We need to fetch all blobs
            file_blobs = file.blobs.all()
            rv = self._check_chunk_ownership(organization, file_blobs, chunks, True)
            if rv is not None:
                return rv

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

            name = file_to_assemble.get('name', None)
            type = file_to_assemble.get('type', ChunkAssembleType.GENERIC)
            params = file_to_assemble.get('params', {})
            # We inject the org slug into the params
            params['org'] = organization.slug
            chunks = file_to_assemble.get('chunks', [])

            try:
                result = self._check_file_blobs(organization, checksum, chunks)
                # This either returns a file OK because we already own all chunks
                # OR we return not_found with the missing chunks (or not owned)
                if result is not None:
                    file_response[checksum] = result
                    continue
            except File.MultipleObjectsReturned:
                return Response({'error': 'Duplicate checksum'},
                                status=400)
            except File.DoesNotExist:
                pass

            # If we have all chunks and the file wasn't found before
            # we create a new file here with the state CREATED
            # Note that this file only exsists while the assemble tasks run
            file = File.objects.create(
                name=name,
                checksum=checksum,
                type='chunked',
                headers={'state': ChunkFileState.CREATED}
            )

            # Load all FileBlobs from db since we can be sure here we already own all
            # chunks need to build the file
            file_blobs = FileBlob.objects.filter(
                checksum__in=chunks
            ).values_list('id', 'checksum')

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

            file_response[checksum] = self._create_file_response(
                ChunkFileState.CREATED
            )

        return Response(file_response, status=200)
