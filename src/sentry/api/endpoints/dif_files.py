from __future__ import absolute_import

import six
import jsonschema

from rest_framework.response import Response

from sentry.utils import json
from sentry.api.serializers import serialize
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import ChunkFileState, ProjectDSymFile, FileBlobOwner, \
    get_assemble_status, set_assemble_status


def find_missing_chunks(organization, chunks):
    """Returns a list of chunks which are missing for an org."""
    owned = set(FileBlobOwner.objects.filter(
        blob__checksum__in=chunks,
        organization=organization,
    ).values_list('blob__checksum', flat=True))
    return list(set(chunks) - owned)


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

            # First, check if this project already owns the DSymFile.
            # This can under rare circumstances yield more than one file
            # which is why we use first() here instead of get().
            dif = ProjectDSymFile.objects.filter(
                project=project,
                file__checksum=checksum
            ).first()
            if dif is None:
                # It does not exist yet.  Check the state we have in cache
                # in case this is a retry poll.
                state, detail = get_assemble_status(project, checksum)
                if state is not None:
                    file_response[checksum] = {
                        'state': state,
                        'detail': detail,
                        'missingChunks': [],
                    }
                    continue

                # There is neither a known file nor a cached state, so we will
                # have to create a new file.  Assure that there are checksums.
                # If not, we assume this is a poll and report NOT_FOUND
                if not chunks:
                    file_response[checksum] = {
                        'state': ChunkFileState.NOT_FOUND,
                        'missingChunks': [],
                    }
                    continue

                # Check if all requested chunks have been uploaded.
                missing_chunks = find_missing_chunks(project.organization, chunks)
                if missing_chunks:
                    file_response[checksum] = {
                        'state': ChunkFileState.NOT_FOUND,
                        'missingChunks': missing_chunks,
                    }
                    continue

                # We don't have a state yet, this means we can now start
                # an assemble job in the background.
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
                    'state': ChunkFileState.CREATED,
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
