from __future__ import annotations

from typing import Any

import jsonschema
import orjson
import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.debug_files.upload import find_missing_chunks
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiAssembleEvent
from sentry.preprod.tasks import assemble_preprod_artifact, create_preprod_artifact
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.ratelimits.config import RateLimitConfig
from sentry.tasks.assemble import ChunkFileState
from sentry.types.ratelimit import RateLimit, RateLimitCategory

SUPPORTED_VCS_PROVIDERS = [
    IntegrationProviderSlug.GITHUB,
    IntegrationProviderSlug.GITLAB,
    IntegrationProviderSlug.GITHUB_ENTERPRISE,
    IntegrationProviderSlug.BITBUCKET,
    IntegrationProviderSlug.BITBUCKET_SERVER,
]


def validate_vcs_parameters(data: dict[str, Any]) -> str | None:
    head_sha = data.get("head_sha")
    base_sha = data.get("base_sha")

    if head_sha and base_sha and head_sha == base_sha:
        return f"Head SHA and base SHA cannot be the same ({head_sha}). Please provide a different base SHA."

    if not head_sha and base_sha:
        return "Head SHA is required when base SHA is provided. Please provide a head SHA."

    # If any VCS parameters are provided, all required ones must be present
    vcs_params = {
        "head_sha": head_sha,
        "head_repo_name": data.get("head_repo_name"),
        "provider": data.get("provider"),
        "head_ref": data.get("head_ref"),
    }

    if any(vcs_params.values()) and any(not v for v in vcs_params.values()):
        missing_params = [k for k, v in vcs_params.items() if not v]
        return f"All required VCS parameters must be provided when using VCS features. Missing parameters: {', '.join(missing_params)}"

    return None


def validate_preprod_artifact_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    """
    Validate the JSON schema for preprod artifact assembly requests.

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
            # Optional metadata
            "build_configuration": {"type": "string"},
            "release_notes": {"type": "string"},
            # VCS parameters - allow empty strings to support clearing auto-filled values
            "head_sha": {"type": "string", "pattern": "^(|[0-9a-f]{40})$"},
            "base_sha": {"type": "string", "pattern": "^(|[0-9a-f]{40})$"},
            "provider": {"type": "string", "maxLength": 255},
            "head_repo_name": {"type": "string", "maxLength": 255},
            "base_repo_name": {"type": "string", "maxLength": 255},
            "head_ref": {"type": "string", "maxLength": 255},
            "base_ref": {"type": "string", "maxLength": 255},
            "pr_number": {"type": "integer", "minimum": 1},
        },
        "required": ["checksum", "chunks"],
        "additionalProperties": False,
    }

    error_messages = {
        "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
        "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
        "build_configuration": "The build_configuration field must be a string.",
        "release_notes": "The release_notes field msut be a string.",
        "head_sha": "The head_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
        "base_sha": "The base_sha field must be a 40-character hexadecimal SHA1 string (no uppercase letters).",
        "provider": "The provider field must be a string with maximum length of 255 characters containing the domain of the VCS provider (ex. github.com)",
        "head_repo_name": "The head_repo_name field must be a string with maximum length of 255 characters.",
        "base_repo_name": "The base_repo_name field must be a string with maximum length of 255 characters.",
        "head_ref": "The head_ref field must be a string with maximum length of 255 characters.",
        "base_ref": "The base_ref field must be a string with maximum length of 255 characters.",
        "pr_number": "The pr_number field must be a positive integer.",
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        # Filter out empty strings to treat them as "not provided"
        filtered_data = {k: v for k, v in data.items() if v != ""}
        return filtered_data, None
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
class ProjectPreprodArtifactAssembleEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectReleasePermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    def post(self, request: Request, project: Project) -> Response:
        """
        Assembles a preprod artifact (mobile build, etc.) and stores it in the database.
        """

        analytics.record(
            PreprodArtifactApiAssembleEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
            )
        )

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        with sentry_sdk.start_span(op="preprod_artifact.assemble"):
            data, error_message = validate_preprod_artifact_schema(request.body)
            if error_message:
                return Response({"error": error_message}, status=400)

            # Support a limited subset of providers
            provider = data.get("provider")
            if provider is not None and provider not in SUPPORTED_VCS_PROVIDERS:
                supported_providers = ", ".join(SUPPORTED_VCS_PROVIDERS)
                return Response(
                    {
                        "error": f"Unsupported VCS provider '{provider}'. Supported providers are: {supported_providers}"
                    },
                    status=400,
                )

            checksum = str(data.get("checksum", ""))
            chunks = data.get("chunks", [])

            # Validate VCS parameters
            vcs_error = validate_vcs_parameters(data)
            if vcs_error:
                return Response({"error": vcs_error}, status=400)

            # Check if all requested chunks have been uploaded
            missing_chunks = find_missing_chunks(project.organization_id, set(chunks))
            if missing_chunks:
                return Response(
                    {
                        "state": ChunkFileState.NOT_FOUND,
                        "missingChunks": missing_chunks,
                    }
                )

            # There is neither a known file nor a cached state, so we will
            # have to create a new file.  Assure that there are checksums.
            # If not, we assume this is a poll and report NOT_FOUND
            if not chunks:
                return Response({"state": ChunkFileState.NOT_FOUND, "missingChunks": []})

            artifact = create_preprod_artifact(
                org_id=project.organization_id,
                project_id=project.id,
                checksum=checksum,
                build_configuration_name=data.get("build_configuration"),
                release_notes=data.get("release_notes"),
                head_sha=data.get("head_sha"),
                base_sha=data.get("base_sha"),
                provider=data.get("provider"),
                head_repo_name=data.get("head_repo_name"),
                base_repo_name=data.get("base_repo_name"),
                head_ref=data.get("head_ref"),
                base_ref=data.get("base_ref"),
                pr_number=data.get("pr_number"),
            )

            if artifact is None:
                return Response(
                    {
                        "state": ChunkFileState.ERROR,
                        "detail": "Failed to create preprod artifact row.",
                    },
                    status=500,
                )

            create_preprod_status_check_task.apply_async(
                kwargs={
                    "preprod_artifact_id": artifact.id,
                }
            )

            assemble_preprod_artifact.apply_async(
                kwargs={
                    "org_id": project.organization_id,
                    "project_id": project.id,
                    "checksum": checksum,
                    "chunks": chunks,
                    "artifact_id": artifact.id,
                    "build_configuration": data.get("build_configuration"),
                }
            )

            if is_org_auth_token_auth(request.auth):
                update_org_auth_token_last_used(request.auth, [project.id])

        artifact_url = get_preprod_artifact_url(artifact)

        return Response(
            {
                "state": ChunkFileState.CREATED,
                "missingChunks": [],
                "artifactUrl": artifact_url,
            }
        )
