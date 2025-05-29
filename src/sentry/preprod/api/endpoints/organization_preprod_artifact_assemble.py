import jsonschema
import orjson
import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.debug_files.upload import find_missing_chunks
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)


@region_silo_endpoint
class ProjectPreprodArtifactAssembleEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project) -> Response:
        """
        Assembles a preprod artifact (mobile build, etc.) and stores it in the database.
        """
        with sentry_sdk.start_span(op="preprod_artifact.assemble"):
            schema = {
                "type": "object",
                "properties": {
                    "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                    "chunks": {
                        "type": "array",
                        "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                    },
                    # Optional metadata
                    "file_name": {"type": "string"},
                    "sha": {"type": "string"},
                    "build_configuration": {"type": "string"},
                    "extras": {"type": "object"},
                },
                "required": ["checksum", "chunks"],
                "additionalProperties": False,
            }

            error_messages = {
                "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
                "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
                "file_name": "The file_name field must be a string.",
                "sha": "The sha field must be a string.",
                "build_configuration": "The build_configuration field must be a string.",
                "extras": "The extras field must be an object.",
            }

            try:
                data = orjson.loads(request.body)
                jsonschema.validate(data, schema)
            except jsonschema.ValidationError as e:
                error_message = e.message
                # Get the field from the path if available
                if e.path:
                    if field := e.path[0]:
                        error_message = error_messages.get(str(field), error_message)

                return Response({"error": error_message}, status=400)
            except Exception:
                return Response({"error": "Invalid json body"}, status=400)

            checksum = data.get("checksum")
            chunks = data.get("chunks", [])

            # Check if all requested chunks have been uploaded
            missing_chunks = find_missing_chunks(project.organization_id, set(chunks))
            if missing_chunks:
                return Response(
                    {
                        "state": ChunkFileState.NOT_FOUND,
                        "missingChunks": missing_chunks,
                    }
                )

            # Check current assembly status
            state, detail = get_assemble_status(AssembleTask.PREPROD_ARTIFACT, project.id, checksum)
            if state == ChunkFileState.OK:
                return Response({"state": state, "detail": detail, "missingChunks": []})
            elif state is not None:
                return Response({"state": state, "detail": detail, "missingChunks": []})

            # There is neither a known file nor a cached state, so we will
            # have to create a new file.  Assure that there are checksums.
            # If not, we assume this is a poll and report NOT_FOUND
            if not chunks:
                return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []})

            set_assemble_status(
                AssembleTask.PREPROD_ARTIFACT, project.id, checksum, ChunkFileState.CREATED
            )

            # Trigger assembly task
            from sentry.tasks.assemble import assemble_preprod_artifact

            assemble_preprod_artifact.apply_async(
                kwargs={
                    "org_id": project.organization_id,
                    "project_id": project.id,
                    "checksum": checksum,
                    "chunks": chunks,
                    "file_name": data.get("file_name"),
                    "sha": data.get("sha"),
                    "build_configuration": data.get("build_configuration"),
                    "extras": data.get("extras"),
                }
            )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id])

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []})
