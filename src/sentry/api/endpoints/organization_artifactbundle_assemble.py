import jsonschema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Project, ProjectStatus
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils import json


@region_silo_endpoint
class OrganizationArtifactBundleAssembleEndpoint(OrganizationReleasesBaseEndpoint):
    def post(self, request: Request, organization) -> Response:
        """
        Assembles an artifact bundle and stores the debug ids in the database.
        """
        schema = {
            "type": "object",
            "properties": {
                "projects": {"type": "array", "items": {"type": "string"}},
                "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                "chunks": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                },
            },
            "required": ["checksum", "chunks", "projects"],
            "additionalProperties": False,
        }

        try:
            data = json.loads(request.body)
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        projects = set(data.get("projects", []))
        if len(projects) == 0:
            return Response({"error": "You need to specify at least one project"}, status=400)

        project_ids = Project.objects.filter(
            organization=organization, status=ProjectStatus.VISIBLE, slug__in=projects
        ).values_list("id", flat=True)
        if len(project_ids) != len(projects):
            return Response({"error": "One or more projects are invalid"}, status=400)

        if not self.has_release_permission(request, organization, project_ids=set(project_ids)):
            raise ResourceDoesNotExist

        checksum = data.get("checksum")
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
                "project_ids": list(project_ids),
                "version": None,
                "checksum": checksum,
                "chunks": chunks,
            }
        )

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []}, status=200)
