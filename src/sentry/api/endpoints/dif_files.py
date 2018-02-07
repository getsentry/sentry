from __future__ import absolute_import

import six
import jsonschema

from rest_framework.response import Response

from sentry.utils import json
from sentry.api.bases.chunk import ChunkAssembleMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import File, ChunkFileState


class DifAssembleEndpoint(ChunkAssembleMixin, ProjectEndpoint):
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

            try:
                result = self._check_file_blobs(project.organization, checksum, chunks)
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

            file, file_blob_ids = self._create_file_for_assembling(name, checksum, chunks)

            # Start the actual worker which does the assembling.
            assemble_dif.apply_async(
                kwargs={
                    'project_id': project.id,
                    'file_id': file.id,
                    'file_blob_ids': file_blob_ids,
                    'checksum': checksum,
                }
            )

            file_response[checksum] = self._create_file_response(
                ChunkFileState.CREATED
            )

        return Response(file_response, status=200)
