import logging

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


def validate_preprod_artifact_size_analysis_schema(request_body: bytes) -> tuple[dict, str | None]:
    """
    Validate the JSON schema for preprod artifact size analysis assembly requests.

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
        },
        "required": ["checksum", "chunks"],
        "additionalProperties": False,
    }

    error_messages = {
        "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
        "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
    }

    try:
        data = orjson.loads(request_body)
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"

    try:
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message

        # Handle missing required fields - be more specific about which field is missing
        if "'checksum' is a required property" in error_message:
            error_message = error_messages["checksum"]
        elif "'chunks' is a required property" in error_message:
            error_message = error_messages["chunks"]
        # Handle additional properties
        elif "Additional properties are not allowed" in error_message:
            error_message = "Additional properties are not allowed"
        # Handle field-specific validation errors
        elif e.path and len(e.path) > 0:
            field = str(e.path[0])
            if field in error_messages:
                error_message = error_messages[field]
        # Handle pattern validation errors when field is identified in message
        elif "does not match" in error_message:
            # For cases where both checksum and chunks might be invalid,
            # check if chunks are invalid and prioritize chunks error if so
            if isinstance(data, dict) and "chunks" in data:
                chunks = data.get("chunks", [])
                if isinstance(chunks, list):
                    for chunk in chunks:
                        if not isinstance(chunk, str) or len(chunk) != 40:
                            # If chunks are invalid, report chunks error
                            error_message = error_messages["chunks"]
                            break
                        # Check if chunk is valid hex
                        try:
                            int(chunk, 16)
                        except ValueError:
                            # If chunks are invalid hex, report chunks error
                            error_message = error_messages["chunks"]
                            break
                    else:
                        # If chunks are valid but we're here, it's likely checksum error
                        error_message = error_messages["checksum"]
                else:
                    error_message = error_messages["chunks"]
            else:
                # Default pattern validation error handling
                if e.absolute_path and len(list(e.absolute_path)) > 0:
                    field_path = list(e.absolute_path)
                    if field_path[0] in error_messages:
                        error_message = error_messages[field_path[0]]
                elif "'checksum'" in error_message:
                    error_message = error_messages["checksum"]
                elif "'chunks'" in error_message or "items" in error_message:
                    error_message = error_messages["chunks"]

        # Final fallback check for missing fields
        if isinstance(data, dict):
            if "checksum" not in data:
                error_message = error_messages["checksum"]
            elif "chunks" not in data:
                error_message = error_messages["chunks"]

        return {}, error_message


@region_silo_endpoint
class ProjectPreprodArtifactAssembleSizeAnalysisEndpoint(ProjectEndpoint):
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
        Assembles a size analysis file for a preprod artifact and stores it in the database.
        """
        if not self._is_authorized(request):
            raise PermissionDenied

        analytics.record(
            "preprod_artifact.api.assemble_size_analysis",
            organization_id=project.organization_id,
            project_id=project.id,
            user_id=request.user.id,
        )

        with sentry_sdk.start_span(op="preprod_artifact.assemble_size_analysis"):
            data, error_message = validate_preprod_artifact_size_analysis_schema(request.body)
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

            # Check current assembly status
            state, detail = get_assemble_status(
                AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS, project.id, checksum
            )
            if state is not None:
                return Response({"state": state, "detail": detail, "missingChunks": []})

            # There is neither a known file nor a cached state, so we will
            # have to create a new file.  Assure that there are checksums.
            # If not, we assume this is a poll and report NOT_FOUND
            if not chunks:
                return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []})

            set_assemble_status(
                AssembleTask.PREPROD_ARTIFACT_SIZE_ANALYSIS,
                project.id,
                checksum,
                ChunkFileState.CREATED,
            )

            assemble_preprod_artifact_size_analysis.apply_async(
                kwargs={
                    "org_id": project.organization_id,
                    "project_id": project.id,
                    "checksum": checksum,
                    "chunks": chunks,
                    "artifact_id": artifact_id,
                }
            )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id])

        return Response({"state": ChunkFileState.CREATED, "missingChunks": []})
