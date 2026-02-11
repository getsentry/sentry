from __future__ import annotations

import logging
from typing import Any

import jsonschema
import orjson
import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


def validate_preprod_snapshot_schema(request_body: bytes) -> tuple[dict[str, Any], str | None]:
    """
    Validate the JSON schema for preprod snapshot requests.

    Returns:
        tuple: (parsed_data, error_message) where error_message is None if validation succeeds
    """
    schema = {
        "type": "object",
        "properties": {
            "shardIndex": {"type": "integer", "minimum": 0},
            "numShards": {"type": "integer", "minimum": 1},
            "preprodArtifactId": {"type": "string"},
            "bundleId": {"type": "string"},
            "sha": {"type": "string"},
            "baseSha": {"type": "string"},
            "images": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "width": {"type": "integer", "minimum": 0},
                        "height": {"type": "integer", "minimum": 0},
                        "colorScheme": {"type": "string"},
                        "orientation": {"type": "string", "enum": ["landscape", "portrait"]},
                        "device": {"type": "string"},
                    },
                    "required": [
                        "width",
                        "height",
                        "colorScheme",
                        "orientation",
                        "device",
                    ],
                    "additionalProperties": False,
                },
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                    },
                    "required": ["type"],
                    "additionalProperties": True,
                },
            },
        },
        "required": ["images", "errors"],
        "additionalProperties": True,
    }

    try:
        data = orjson.loads(request_body)
        jsonschema.validate(data, schema)
        return data, None
    except jsonschema.ValidationError as e:
        error_message = e.message
        return {}, error_message
    except (orjson.JSONDecodeError, TypeError):
        return {}, "Invalid json body"


@region_silo_endpoint
class ProjectPreprodSnapshotEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
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

    def get(self, request: Request, project: Project, snapshot_id: str) -> Response:
        """
        Retrieves snapshot data with all shards and paginated images
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        try:
            offset = int(request.GET.get("offset", "0"))
            limit = int(request.GET.get("limit", "20"))
        except ValueError:
            return Response({"error": "Invalid offset or limit parameter"}, status=400)

        if offset < 0 or limit <= 0 or limit > 100:
            return Response(
                {"error": "offset must be >= 0, limit must be > 0 and <= 100"}, status=400
            )

        with sentry_sdk.start_span(op="preprod_artifact.get_snapshot_data"):
            return Response(
                {},
                status=200,
            )

    def post(self, request: Request, project: Project) -> Response:
        """
        Creates snapshot data for a preprod artifact
        """

        if not settings.IS_DEV and not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        # Validate the request body
        data, error_message = validate_preprod_snapshot_schema(request.body)
        if error_message:
            return Response({"error": error_message}, status=400)

        with sentry_sdk.start_span(op="preprod_artifact.snapshot"):
            return Response(
                {},
                status=200,
            )
