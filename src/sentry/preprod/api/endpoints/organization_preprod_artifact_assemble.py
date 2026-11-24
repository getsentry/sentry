from __future__ import annotations

from typing import Annotated, Any, NotRequired, TypedDict

import jsonschema
import orjson
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import traces

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.formats import Url, absolute_url
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.conf.types.sentry_config import SentryMode
from sentry.debug_files.upload import find_missing_chunks
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.orgauthtoken import is_org_auth_token_auth, update_org_auth_token_last_used
from sentry.models.project import Project
from sentry.preprod.analytics import PreprodArtifactApiAssembleEvent
from sentry.preprod.api.schemas import SHA_PATTERN, VCS_ERROR_MESSAGES, VCS_SCHEMA_PROPERTIES
from sentry.preprod.exceptions import NoPreprodQuota
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

MAX_INSTALL_GROUPS = 16


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
    }

    if any(vcs_params.values()) and any(not v for v in vcs_params.values()):
        missing_params = [k for k, v in vcs_params.items() if not v]
        return f"All required VCS parameters must be provided when using VCS features. Missing parameters: {', '.join(missing_params)}"

    return None


# Shared by request validation and the OpenAPI schema.
PREPROD_ARTIFACT_ASSEMBLE_REQUEST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "checksum": {
            "type": "string",
            "pattern": SHA_PATTERN,
            "description": "SHA-1 checksum of the whole build file.",
        },
        "chunks": {
            "type": "array",
            "items": {"type": "string", "pattern": SHA_PATTERN},
            "description": "SHA-1 checksums of the file's chunks, in order. Upload missing chunks with the chunk upload endpoint first.",
        },
        # Optional metadata
        "build_configuration": {
            "type": "string",
            "description": "Name of the build configuration, such as `Release` or `Debug`.",
        },
        "release_notes": {
            "type": "string",
            "description": "Release notes to show with the build.",
        },
        "install_groups": {
            "type": "array",
            "items": {"type": "string", "minLength": 1, "maxLength": 255},
            "minItems": 1,
            "maxItems": MAX_INSTALL_GROUPS,
            "uniqueItems": True,
            "description": "Install groups that can install the build.",
        },
        **VCS_SCHEMA_PROPERTIES,
    },
    "required": ["checksum", "chunks"],
    "additionalProperties": False,
}


class PreprodArtifactAssembleResponse(TypedDict):
    # ChunkFileState values are plain strs, so this field can't be a Literal.
    state: Annotated[
        str,
        ApiDescription(
            "State of the build file: not_found if chunks are missing or none were sent, created once the build is queued for assembly"
        ),
    ]
    missingChunks: Annotated[
        list[str], ApiDescription("Checksums of the chunks the server doesn't have yet")
    ]
    artifactUrl: NotRequired[
        Annotated[
            Url, ApiDescription("URL of the build in Sentry. Only set when the state is created")
        ]
    ]


class _AssembleErrorResponse(TypedDict):
    error: str


class _AssembleFailedResponse(TypedDict):
    state: str
    detail: str


def validate_preprod_artifact_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    """
    Validate the JSON schema for preprod artifact assembly requests.

    Returns:
        tuple: (parsed_data, error_message) where error_message is None if validation succeeds
    """
    error_messages = {
        "checksum": "The checksum field is required and must be a 40-character hexadecimal string.",
        "chunks": "The chunks field is required and must be provided as an array of 40-character hexadecimal strings.",
        "build_configuration": "The build_configuration field must be a string.",
        "release_notes": "The release_notes field must be a string.",
        "install_groups": f"The install_groups field must contain between 1 and {MAX_INSTALL_GROUPS} unique, non-empty strings, each with a maximum length of 255 characters.",
        **VCS_ERROR_MESSAGES,
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, PREPROD_ARTIFACT_ASSEMBLE_REQUEST_SCHEMA)
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


@extend_schema(tags=["Mobile Builds"])
@cell_silo_endpoint
class ProjectPreprodArtifactAssembleEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.PUBLIC,
    }
    # A resend after the build left the uploading state creates another build, and every
    # request queues assembly and status check tasks again.
    idempotent_methods = frozenset()
    permission_classes = (ProjectReleasePermission,)

    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="assembleProjectPreprodArtifact",
        summary="Assemble a Mobile Build",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request={"application/json": PREPROD_ARTIFACT_ASSEMBLE_REQUEST_SCHEMA},
        responses={
            200: inline_sentry_response_serializer(
                "PreprodArtifactAssembleResponse", PreprodArtifactAssembleResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.ASSEMBLE_ARTIFACT,
    )
    def post(
        self, request: Request, project: Project
    ) -> (
        Response[PreprodArtifactAssembleResponse]
        | Response[_AssembleErrorResponse]
        | Response[_AssembleFailedResponse]
        | Response[DetailResponse]
    ):
        """
        Assemble previously uploaded chunks into a mobile build, such as an APK, AAB or
        XCArchive, and queue it for size analysis.

        Upload the build file's chunks with the chunk upload endpoint first. If chunks are
        missing, the response has the state `not_found` and lists them in
        `missingChunks`: upload them and send the request again. Once all chunks are there,
        the build is created, the response has the state `created`, and `artifactUrl` links
        to the build in Sentry.

        Don't resend a request that succeeded: each successful request creates a build.
        Empty strings in optional fields count as not set. The VCS fields `head_sha`,
        `head_repo_name` and `provider` must be set together. `provider` must be one of
        `github`, `github_enterprise`, `gitlab`, `bitbucket` or `bitbucket_server`.
        """

        if settings.SENTRY_MODE == SentryMode.SINGLE_TENANT:
            return Response(
                {"detail": "Size analysis uploads are not enabled for this organization."},
                status=403,
            )

        analytics.record(
            PreprodArtifactApiAssembleEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=acting_user_id(request.user),
            )
        )

        with traces.start_span(
            name="preprod_artifact.assemble", attributes={"sentry.op": "preprod_artifact.assemble"}
        ):
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
                missing: PreprodArtifactAssembleResponse = {
                    "state": ChunkFileState.NOT_FOUND,
                    "missingChunks": missing_chunks,
                }
                return Response(missing)

            # There is neither a known file nor a cached state, so we will
            # have to create a new file.  Assure that there are checksums.
            # If not, we assume this is a poll and report NOT_FOUND
            if not chunks:
                poll: PreprodArtifactAssembleResponse = {
                    "state": ChunkFileState.NOT_FOUND,
                    "missingChunks": [],
                }
                return Response(poll)

            try:
                artifact = create_preprod_artifact(
                    org_id=project.organization_id,
                    project_id=project.id,
                    checksum=checksum,
                    build_configuration_name=data.get("build_configuration"),
                    release_notes=data.get("release_notes"),
                    install_groups=data.get("install_groups"),
                    head_sha=data.get("head_sha"),
                    base_sha=data.get("base_sha"),
                    provider=data.get("provider"),
                    head_repo_name=data.get("head_repo_name"),
                    base_repo_name=data.get("base_repo_name"),
                    head_ref=data.get("head_ref"),
                    base_ref=data.get("base_ref"),
                    pr_number=data.get("pr_number"),
                )
            except NoPreprodQuota:
                return Response(
                    {"detail": "Organization does not have quota for preprod features"},
                    status=403,
                )

            if artifact is None:
                failed: _AssembleFailedResponse = {
                    "state": ChunkFileState.ERROR,
                    "detail": "Failed to create preprod artifact row.",
                }
                return Response(failed, status=500)

            create_preprod_status_check_task.apply_async(
                kwargs={
                    "preprod_artifact_id": artifact.id,
                    "caller": "assemble_endpoint",
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

        created: PreprodArtifactAssembleResponse = {
            "state": ChunkFileState.CREATED,
            "missingChunks": [],
            "artifactUrl": absolute_url(get_preprod_artifact_url(artifact)),
        }
        return Response(created)
