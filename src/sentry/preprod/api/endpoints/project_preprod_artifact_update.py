import jsonschema
import orjson
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.authentication import LaunchpadRpcSignatureAuthentication
from sentry.preprod.models import PreprodArtifact
from sentry.utils import json


def validate_preprod_artifact_update_schema(request_body: bytes) -> tuple[dict, str | None]:
    """
    Validate the JSON schema for preprod artifact update requests.

    Returns:
        tuple: (parsed_data, error_message) where error_message is None if validation succeeds
    """
    schema = {
        "type": "object",
        "properties": {
            # Optional metadata
            "date_built": {"type": "string"},
            "artifact_type": {"type": "integer", "minimum": 0, "maximum": 2},
            "build_version": {"type": "string", "maxLength": 255},
            "build_number": {"type": "integer"},
            "error_code": {"type": "integer", "minimum": 0, "maximum": 3},
            "error_message": {"type": "string"},
            "apple_app_info": {
                "type": "object",
                "properties": {
                    "is_simulator": {"type": "boolean"},
                    "codesigning_type": {"type": "string"},
                    "profile_name": {"type": "string"},
                    "is_code_signature_valid": {"type": "boolean"},
                    "code_signature_errors": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "additionalProperties": True,
    }

    error_messages = {
        "date_built": "The date_built field must be a string.",
        "artifact_type": "The artifact_type field must be an integer between 0 and 2.",
        "error_code": "The error_code field must be an integer between 0 and 3.",
        "error_message": "The error_message field must be a string.",
        "build_version": "The build_version field must be a string with a maximum length of 255 characters.",
        "build_number": "The build_number field must be an integer.",
        "apple_app_info": "The apple_app_info field must be an object.",
        "apple_app_info.is_simulator": "The is_simulator field must be a boolean.",
        "apple_app_info.codesigning_type": "The codesigning_type field must be a string.",
        "apple_app_info.profile_name": "The profile_name field must be a string.",
        "apple_app_info.is_code_signature_valid": "The is_code_signature_valid field must be a boolean.",
        "apple_app_info.code_signature_errors": "The code_signature_errors field must be an array of strings.",
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        validation_error_message = e.message
        # Get the field from the path if available
        if e.path:
            if field := e.path[0]:
                validation_error_message = error_messages.get(str(field), validation_error_message)
        return {}, validation_error_message
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"


@region_silo_endpoint
class ProjectPreprodArtifactUpdateEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (LaunchpadRpcSignatureAuthentication,)
    permission_classes = ()

    def _is_authorized(self, request: Request) -> bool:
        if request.auth and isinstance(
            request.successful_authenticator, LaunchpadRpcSignatureAuthentication
        ):
            return True
        return False

    def put(self, request: Request, project, artifact_id) -> Response:
        """
        Update a preprod artifact with preprocessed data
        ```````````````````````````````````````````````

        Update the preprod artifact with data from preprocessing, such as
        artifact type, build information, and processing status.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project the artifact
                                     belongs to.
        :pparam string artifact_id: the ID of the preprod artifact to update.
        :auth: required
        """
        if not self._is_authorized(request):
            raise PermissionDenied

        analytics.record(
            "preprod_artifact.api.update",
            organization_id=project.organization_id,
            project_id=project.id,
        )

        # Validate request data
        data, error_message = validate_preprod_artifact_update_schema(request.body)
        if error_message:
            return Response({"error": error_message}, status=400)

        # Get the artifact
        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        updated_fields = []

        if "date_built" in data:
            preprod_artifact.date_built = data["date_built"]
            updated_fields.append("date_built")

        if "artifact_type" in data:
            preprod_artifact.artifact_type = data["artifact_type"]
            updated_fields.append("artifact_type")

        if "error_code" in data:
            preprod_artifact.error_code = data["error_code"]
            updated_fields.append("error_code")

        if "error_message" in data:
            preprod_artifact.error_message = data["error_message"]
            updated_fields.append("error_message")

        if "error_code" in data or "error_message" in data:
            preprod_artifact.state = PreprodArtifact.ArtifactState.FAILED
            updated_fields.append("state")

        if "build_version" in data:
            preprod_artifact.build_version = data["build_version"]
            updated_fields.append("build_version")

        if "build_number" in data:
            preprod_artifact.build_number = data["build_number"]
            updated_fields.append("build_number")

        if "apple_app_info" in data:
            apple_info = data["apple_app_info"]
            parsed_apple_info = {}
            for field in [
                "is_simulator",
                "codesigning_type",
                "profile_name",
                "is_code_signature_valid",
                "code_signature_errors",
            ]:
                if field in apple_info:
                    parsed_apple_info[field] = apple_info[field]

            if parsed_apple_info:
                preprod_artifact.extras = json.dumps(parsed_apple_info)
                updated_fields.append("extras")

        # Save the artifact if any fields were updated
        if updated_fields:
            if preprod_artifact.state != PreprodArtifact.ArtifactState.FAILED:
                preprod_artifact.state = PreprodArtifact.ArtifactState.PROCESSED
                updated_fields.append("state")

            preprod_artifact.save(update_fields=updated_fields + ["date_updated"])

        return Response(
            {
                "success": True,
                "artifact_id": artifact_id,
                "updated_fields": updated_fields,
            }
        )
