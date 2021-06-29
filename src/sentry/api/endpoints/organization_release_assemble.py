import jsonschema
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Release
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils import json


class OrganizationReleaseAssembleEndpoint(OrganizationReleasesBaseEndpoint):
    def post(self, request, organization, version):
        """
        Handle an artifact bundle and merge it into the release
        ```````````````````````````````````````````````````````

        :auth: required
        """

        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        schema = {
            "type": "object",
            "properties": {
                "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                "chunks": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                },
            },
            "required": ["checksum", "chunks"],
            "additionalProperties": False,
        }

        try:
            data = json.loads(request.body)
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        checksum = data.get("checksum", None)
        chunks = data.get("chunks", [])

        state, detail = get_assemble_status(AssembleTask.ARTIFACTS, organization.id, checksum)
        if state == ChunkFileState.OK:
            return Response({"state": state, "detail": None, "missingChunks": []}, status=200)
        elif state is not None:
            return Response({"state": state, "detail": detail, "missingChunks": []})

        # There is neither a known file nor a cached state, so we will
        # have to create a new file.  Assure that there are checksums.
        # If not, we assume this is a poll and report NOT_FOUND
        if not chunks:
            return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []}, status=200)

        set_assemble_status(
            AssembleTask.ARTIFACTS, organization.id, checksum, ChunkFileState.CREATED
        )

        from sentry.tasks.assemble import assemble_artifacts

        assemble_artifacts.apply_async(
            kwargs={
                "org_id": organization.id,
                "version": version,
                "checksum": checksum,
                "chunks": chunks,
            }
        )

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []}, status=200)
