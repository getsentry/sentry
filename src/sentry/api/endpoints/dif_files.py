from __future__ import absolute_import

import six
import hashlib
import jsonschema

from rest_framework.response import Response

from sentry.utils import json
from sentry.api.serializers import serialize
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import ChunkFileState, ProjectDSymFile, FileBlob
from sentry.utils.cache import cache


# XXX: move this function
def get_idempotency_id(project, checksum):
    """For some operations an idempotency ID is needed."""
    return hashlib.sha1(b'%s|%s|project.dsym' % (
        str(project.id).encode('ascii'),
        checksum.encode('ascii'),
    ))


# XXX: move this function
def get_assemble_status(project, checksum):
    """For a given file it checks what the current status of the assembling is.
    Returns a tuple in the form ``(status, details)`` where details is either
    `None` or a string identifying an error condition or notice.
    """
    cache_key = 'assemble-status:%s' % get_idempotency_id(
        project, checksum)
    rv = cache.get(cache_key)
    if rv is None:
        return None, None
    return tuple(rv)


# XXX: move this function
def set_assemble_status(project, checksum, state, detail=None):
    cache_key = 'assemble-status:%s' % get_idempotency_id(
        project, checksum)
    cache.set(cache_key, (state, detail), 300)


def find_missing_chunks(organization, chunks):
    """Returns a list of chunks which are missing for an org."""
    if not chunks:
        return []
    missing = set(chunks)
    for blob in FileBlob.objects.filter(checksum__in=chunks):
        chunks.discard(blob.checksum)
    return list(missing)


class DifAssembleEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission, )

    def post(self, request, project):
        """
        Assmble one or multiple chunks (FileBlob) into dsym files
        `````````````````````````````````````````````````````````

        :auth: required
        """
        schema = {
            "type": "object",
            "patternProperties": {
                "^[0-9a-f]{40}$": {
                    "type": "object",
                    "required": ["name", "chunks"],
                    "properties": {
                        "name": {"type": "string"},
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

        from sentry.tasks.assemble import assemble_dif
        for checksum, file_to_assemble in six.iteritems(files):
            name = file_to_assemble.get('name', None)
            chunks = file_to_assemble.get('chunks', [])

            missing_chunks = find_missing_chunks(project.organization, chunks)

            # If there are any missing chunks, skip.
            if missing_chunks:
                file_response[checksum] = {
                    'state': ChunkFileState.NOT_FOUND,
                    'missingChunks': missing_chunks,
                }
                continue

            # Under the assumption we have all chunks, check if a dsym
            # file with the checksum exists for the project.
            try:
                dif = ProjectDSymFile.objects.filter(
                    project=project,
                    file__checksum=checksum
                ).get()
            except ProjectDSymFile.DoesNotExist:
                # it does not exist yet.  Check the state we have in cache
                # in case this is a retry poll.
                state, detail = get_assemble_status(project, checksum)

                # We don't have a state yet, this means we can now start
                # an assemble job in the background.
                if state is None:
                    state = ChunkFileState.CREATED
                    set_assemble_status(project, checksum, state)
                    assemble_dif.apply_async(
                        kwargs={
                            'project_id': project.id,
                            'name': name,
                            'checksum': checksum,
                            'chunks': chunks,
                        }
                    )

                file_response[checksum] = {
                    'state': state,
                    'detail': detail,
                    'missingChunks': [],
                }
            else:
                file_response[checksum] = {
                    'state': ChunkFileState.OK,
                    'detail': None,
                    'missingChunks': [],
                    'dif': serialize(dif),
                }

        return Response(file_response, status=200)
