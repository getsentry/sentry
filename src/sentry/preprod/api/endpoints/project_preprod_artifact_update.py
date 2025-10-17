from __future__ import annotations

import logging
import re
from typing import Any

import jsonschema
import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.preprod.analytics import PreprodArtifactApiUpdateEvent
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.authentication import (
    LaunchpadRpcPermission,
    LaunchpadRpcSignatureAuthentication,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task

logger = logging.getLogger(__name__)


def validate_preprod_artifact_update_schema(
    request_body: bytes,
) -> tuple[dict[str, Any], str | None]:
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
            "app_id": {"type": "string", "maxLength": 255},
            "app_name": {"type": "string", "maxLength": 255},
            "apple_app_info": {
                "type": "object",
                "properties": {
                    "main_binary_uuid": {"type": "string", "maxLength": 255},
                    "is_simulator": {"type": "boolean"},
                    "codesigning_type": {"type": "string"},
                    "profile_name": {"type": "string"},
                    "profile_expiration_date": {"type": "string"},
                    "certificate_expiration_date": {"type": "string"},
                    "is_code_signature_valid": {"type": "boolean"},
                    "code_signature_errors": {"type": "array", "items": {"type": "string"}},
                },
            },
            "dequeued_at": {"type": "string"},
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
        "app_id": "The app_id field must be a string with a maximum length of 255 characters.",
        "app_name": "The app_name field must be a string with a maximum length of 255 characters.",
        "apple_app_info": "The apple_app_info field must be an object.",
        "apple_app_info.is_simulator": "The is_simulator field must be a boolean.",
        "apple_app_info.codesigning_type": "The codesigning_type field must be a string.",
        "apple_app_info.profile_name": "The profile_name field must be a string.",
        "apple_app_info.is_code_signature_valid": "The is_code_signature_valid field must be a boolean.",
        "apple_app_info.code_signature_errors": "The code_signature_errors field must be an array of strings.",
        "dequeued_at": "The dequeued_at field must be a string.",
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


def find_or_create_release(
    project: Project, package: str, version: str, build_number: int | None = None
) -> Release | None:
    """
    Find or create a release based on package, version, and project.

    Creates release version in format: package@version+build_number (if build_number provided)
    or package@version (if no build_number)

    Args:
        project: The project to search/create the release for
        package: The package identifier (e.g., "com.myapp.MyApp")
        version: The version string (e.g., "1.2.300")
        build_number: Optional build number to include in release version

    Returns:
        Release object if found/created, None if creation fails
    """
    try:
        base_version = f"{package}@{version}"
        existing_release = Release.objects.filter(
            organization_id=project.organization_id,
            projects=project,
            version__regex=rf"^{re.escape(base_version)}(\+\d+)?$",
        ).first()

        if existing_release:
            logger.info(
                "Found existing release for preprod artifact",
                extra={
                    "project_id": project.id,
                    "package": package,
                    "version": version,
                    "build_number": build_number,
                    "existing_release_version": existing_release.version,
                    "existing_release_id": existing_release.id,
                },
            )
            return existing_release

        if build_number is not None:
            release_version = f"{package}@{version}+{build_number}"
        else:
            release_version = base_version

        release = Release.get_or_create(
            project=project,
            version=release_version,
        )

        logger.info(
            "Created new release for preprod artifact",
            extra={
                "project_id": project.id,
                "package": package,
                "version": version,
                "build_number": build_number,
                "created_release_version": release.version,
                "created_release_id": release.id,
            },
        )

        return release

    except Exception as e:
        logger.exception(
            "Failed to find or create release",
            extra={
                "project_id": project.id,
                "package": package,
                "version": version,
                "build_number": build_number,
                "error": str(e),
            },
        )
        return None


@region_silo_endpoint
class ProjectPreprodArtifactUpdateEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (LaunchpadRpcSignatureAuthentication,)
    permission_classes = (LaunchpadRpcPermission,)

    def put(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        Update a preprod artifact with preprocessed data
        ```````````````````````````````````````````````

        Update the preprod artifact with data from preprocessing, such as
        artifact type, build information, and processing status.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project the artifact
                                     belongs to.
        :pparam string head_artifact_id: the ID of the preprod artifact to update.
        :pparam object head_artifact: the preprod artifact to update.
        :auth: required
        """
        analytics.record(
            PreprodArtifactApiUpdateEvent(
                organization_id=project.organization_id,
                project_id=project.id,
            )
        )

        data, error_message = validate_preprod_artifact_update_schema(request.body)
        if error_message:
            return Response({"error": error_message}, status=400)

        try:
            artifact_id_int = int(head_artifact_id)
            if artifact_id_int <= 0:
                raise ValueError("ID must be positive")
        except (ValueError, TypeError):
            return Response({"error": "Invalid artifact ID format"}, status=400)

        updated_fields = []

        if "date_built" in data:
            head_artifact.date_built = data["date_built"]
            updated_fields.append("date_built")

        if "artifact_type" in data:
            head_artifact.artifact_type = data["artifact_type"]
            updated_fields.append("artifact_type")

        if "error_code" in data:
            head_artifact.error_code = data["error_code"]
            updated_fields.append("error_code")

        if "error_message" in data:
            head_artifact.error_message = data["error_message"]
            updated_fields.append("error_message")

        if "error_code" in data or "error_message" in data:
            head_artifact.state = PreprodArtifact.ArtifactState.FAILED
            updated_fields.append("state")

        if "build_version" in data:
            head_artifact.build_version = data["build_version"]
            updated_fields.append("build_version")

        if "build_number" in data:
            head_artifact.build_number = data["build_number"]
            updated_fields.append("build_number")

        if "app_id" in data:
            head_artifact.app_id = data["app_id"]
            updated_fields.append("app_id")

        if "app_name" in data:
            head_artifact.app_name = data["app_name"]
            updated_fields.append("app_name")

        extras_updates = {}

        if "apple_app_info" in data:
            apple_info = data["apple_app_info"]
            if "main_binary_uuid" in apple_info:
                head_artifact.main_binary_identifier = apple_info["main_binary_uuid"]
                updated_fields.append("main_binary_identifier")

            for field in [
                "is_simulator",
                "codesigning_type",
                "profile_name",
                "profile_expiration_date",
                "certificate_expiration_date",
                "is_code_signature_valid",
                "code_signature_errors",
            ]:
                if field in apple_info:
                    extras_updates[field] = apple_info[field]

        if "dequeued_at" in data:
            extras_updates["dequeued_at"] = data["dequeued_at"]

        if extras_updates:
            if head_artifact.extras is None:
                head_artifact.extras = {}
            head_artifact.extras.update(extras_updates)
            updated_fields.append("extras")

        if updated_fields:
            if head_artifact.state != PreprodArtifact.ArtifactState.FAILED:
                head_artifact.state = PreprodArtifact.ArtifactState.PROCESSED
                updated_fields.append("state")

            head_artifact.save(update_fields=updated_fields + ["date_updated"])

            create_preprod_status_check_task.apply_async(
                kwargs={
                    "preprod_artifact_id": artifact_id_int,
                }
            )

        if (
            head_artifact.app_id
            and head_artifact.build_version
            and head_artifact.state == PreprodArtifact.ArtifactState.PROCESSED
        ):
            find_or_create_release(
                project=project,
                package=head_artifact.app_id,
                version=head_artifact.build_version,
                build_number=head_artifact.build_number,
            )

        return Response(
            {
                "success": True,
                "artifactId": head_artifact_id,
                "updatedFields": updated_fields,
            }
        )
