import logging
from enum import Enum

import jsonschema
import orjson
import sentry_sdk
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.debug_files.upload import find_missing_chunks
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.preprod.tasks import assemble_preprod_artifact_size_analysis
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)

logger = logging.getLogger(__name__)


class AssembleType(Enum):
    SIZE_ANALYSIS = "size_analysis"
    INSTALLABLE_APP = "installable_app"


def validate_preprod_artifact_generic_schema(request_body: bytes) -> tuple[dict, str | None]:
    """
    Validate the JSON schema for preprod artifact related generic assembly requests.

    Returns:
        tuple: (parsed_data, error_message) where error_message is None if validation succeeds
    """
    schema = {
        "type": "object",
        "properties": {
            "checksum": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            "chunks": {
                "type": "array",
                "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
            },
            "assemble_type": {
                "type": "string",
                "enum": [t.value for t in AssembleType],
            },
        },
        "required": ["checksum", "chunks", "assemble_type"],
        "additionalProperties": False,
    }

    error_messages = {
        "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
        "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
        "assemble_type": "The assemble_type field is required and must be a valid assemble type.",
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
        # Get the field from the path if available
        if e.path:
            if field := e.path[0]:
                error_message = error_messages.get(str(field), error_message)
        return {}, error_message
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"


@region_silo_endpoint
class ProjectPreprodArtifactAssembleGenericEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (LaunchpadRpcSignatureAuthentication,)
    permission_classes = ()

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, LaunchpadRpcSignatureAuthentication
        ):
            return True
        return False

    def post(self, request: Request, project, artifact_id) -> Response:
        """
        Assembles a generic file for a preprod artifact and stores it in the database.
        """
        if not self._is_authorized(request):
            raise PermissionDenied

        analytics.record(
            "preprod_artifact.api.assemble_generic",
            organization_id=project.organization_id,
            project_id=project.id,
        )

        with sentry_sdk.start_span(op="preprod_artifact.assemble_generic"):
            data, error_message = validate_preprod_artifact_generic_schema(request.body)
            if error_message:
                return Response({"error": error_message}, status=400)

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

            assemble_type = data.get("assemble_type")

            def update_assemble_status(task: str):
                # Check current assembly status
                state, detail = get_assemble_status(task, project.id, checksum)
                if state is not None:
                    return Response({"state": state, "detail": detail, "missingChunks": []})

                # There is neither a known file nor a cached state, so we will
                # have to create a new file.  Assure that there are checksums.
                # If not, we assume this is a poll and report NOT_FOUND
                if not chunks:
                    return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []})

                set_assemble_status(
                    task,
                    project.id,
                    checksum,
                    ChunkFileState.CREATED,
                )

            if assemble_type == AssembleType.SIZE_ANALYSIS.value:
                response = update_assemble_status(AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS)
                if response:
                    return response

                assemble_preprod_artifact_size_analysis.apply_async(
                    kwargs={
                        "org_id": project.organization_id,
                        "project_id": project.id,
                        "checksum": checksum,
                        "chunks": chunks,
                        "artifact_id": artifact_id,
                    }
                )
            else:
                return Response(
                    {"error": f"Unsupported assemble_type: {assemble_type}"}, status=400
                )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id])

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []})
