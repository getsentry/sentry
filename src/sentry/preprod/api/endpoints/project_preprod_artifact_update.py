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


def validate_preprod_artifact_update_schema(request_body: bytes) -> tuple[dict, str | None]:
    """
    Validate the JSON schema for preprod artifact update requests.

    Returns:
        tuple: (parsed_data, error_message) where error_message is None if validation succeeds
    """
    schema = {
        "type": "object",
        "properties": {
            "date_built": {"type": "string"},
            "artifact_type": {"type": "integer", "minimum": 0, "maximum": 2},
            "error_message": {"type": "string"},
            "build_version": {"type": "string", "maxLength": 255},
            "build_number": {"type": "integer"},
        },
        "additionalProperties": False,
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        return {}, f"Validation error: {e.message}"
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
            user_id=request.user.id,
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

        if "error_message" in data:
            preprod_artifact.error_message = data["error_message"]
            updated_fields.append("error_message")

        if "build_version" in data:
            preprod_artifact.build_version = data["build_version"]
            updated_fields.append("build_version")

        if "build_number" in data:
            preprod_artifact.build_number = data["build_number"]
            updated_fields.append("build_number")

        # Save the artifact if any fields were updated
        if updated_fields:
            preprod_artifact.save(update_fields=updated_fields + ["date_updated"])

        return Response(
            {
                "success": True,
                "artifact_id": artifact_id,
                "updated_fields": updated_fields,
            }
        )
