from __future__ import annotations

import logging
from typing import Any

import jsonschema
import orjson
import sentry_sdk
from django.conf import settings
from objectstore_client import RequestError, Session
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session
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
            "shardInfo": {
                "type": "object",
                "properties": {
                    "shardIndex": {"type": "integer", "minimum": 0},
                    "totalShards": {"type": "integer", "minimum": 1},
                    "shardId": {"type": "string"},
                },
                "required": ["shardIndex", "totalShards", "shardId"],
                "additionalProperties": False,
            },
            "preprodArtifactId": {"type": "string"},
            "bundleId": {"type": "string"},
            "sha": {"type": "string"},
            "baseSha": {"type": "string"},
            "images": {
                "type": "object",
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "group": {"type": "string"},
                        "displayName": {"type": "string"},
                        "fileId": {"type": "string"},
                        "width": {"type": "integer", "minimum": 0},
                        "height": {"type": "integer", "minimum": 0},
                        "colorScheme": {"type": "string"},
                        "orientation": {"type": "string", "enum": ["landscape", "portrait"]},
                        "device": {"type": "string"},
                    },
                    "required": [
                        "group",
                        "displayName",
                        "fileId",
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
        "required": ["bundleId", "sha", "baseSha", "images", "errors"],
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


def get_num_shards_from_snapshot(
    org: int, session: Session, snapshot_id: str
) -> tuple[int | None, str | None]:
    """
    Retrieves the numShards field from the first shard of a snapshot.

    Returns:
        tuple: (num_shards, error_message) where error_message is None if successful
    """
    first_shard_key = f"{org}/{snapshot_id}/shard-0.json"
    try:
        first_shard_data = session.get(first_shard_key)
        first_shard_parsed = orjson.loads(first_shard_data.payload.read())
        num_shards = first_shard_parsed.get("numShards")

        if num_shards is None:
            return None, "First shard does not contain numShards field"

        return num_shards, None
    except RequestError:
        return None, "Snapshot not found - shard 0 does not exist"
    except (orjson.JSONDecodeError, TypeError, KeyError) as e:
        return None, f"Failed to parse first shard data: {str(e)}"


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

        # Pagination parameters for images
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
            session = get_preprod_session(project.organization_id, project.id)

            # Get the expected number of shards from shard 0
            num_shards, error_message = get_num_shards_from_snapshot(
                project.organization_id, session, snapshot_id
            )
            if error_message or num_shards is None:
                status_code = 404 if error_message and "not found" in error_message else 400
                return Response({"error": error_message or "Invalid snapshot"}, status=status_code)

            # Fetch all shards and aggregate images
            all_shards = []
            all_images = []

            for shard_index in range(num_shards):
                shard_key = f"{project.organization_id}/{snapshot_id}/shard-{shard_index}.json"
                try:
                    shard_data = session.get(shard_key)
                    payload_data = shard_data.payload.read()
                    shard_json = orjson.loads(payload_data)

                    all_shards.append(
                        {
                            "shardIndex": shard_index,
                            "key": shard_key,
                            "uploaded": True,
                            "size": len(payload_data),
                        }
                    )

                    # Extract images from shard
                    shard_images = shard_json.get("images", [])
                    for image in shard_images:
                        if "typeDisplayName" in image:
                            # Preview Provider
                            all_images.append(
                                {
                                    "key": image.get("key"),
                                    "id": image.get("id"),
                                    "title": image.get("displayName"),
                                    "group": image.get("typeDisplayName"),
                                    "width": image.get("width"),
                                    "height": image.get("height"),
                                    "colorScheme": image.get("colorScheme"),
                                }
                            )
                        if "fileId" in image:
                            # Preview macro
                            all_images.append(
                                {
                                    "key": image.get("key"),
                                    "id": image.get("id"),
                                    "title": image.get("displayName"),
                                    "group": image.get("fileId"),
                                    "width": image.get("width"),
                                    "height": image.get("height"),
                                    "colorScheme": image.get("colorScheme"),
                                }
                            )
                except RequestError:
                    all_shards.append(
                        {
                            "shardIndex": shard_index,
                            "key": shard_key,
                            "uploaded": False,
                        }
                    )
                except (orjson.JSONDecodeError, TypeError, KeyError) as e:
                    logger.warning(
                        "Failed to parse shard data",
                        extra={
                            "project_id": project.id,
                            "organization_id": project.organization_id,
                            "snapshot_id": snapshot_id,
                            "shard_index": shard_index,
                            "error": str(e),
                        },
                    )
                    all_shards.append(
                        {
                            "shardIndex": shard_index,
                            "key": shard_key,
                            "uploaded": True,
                            "size": 0,
                        }
                    )

            # Apply pagination to images
            paginated_images = all_images[offset : offset + limit]
            uploaded_count = sum(1 for shard in all_shards if shard["uploaded"])
            all_uploaded = uploaded_count == num_shards

            logger.info(
                "Retrieved snapshot data",
                extra={
                    "project_id": project.id,
                    "organization_id": project.organization_id,
                    "snapshot_id": snapshot_id,
                    "expected_shards": num_shards,
                    "uploaded_shards": uploaded_count,
                    "all_uploaded": all_uploaded,
                    "total_images": len(all_images),
                    "offset": offset,
                    "limit": limit,
                },
            )

            return Response(
                {
                    "snapshotId": snapshot_id,
                    "numShards": num_shards,
                    "uploadedShards": uploaded_count,
                    "allUploaded": all_uploaded,
                    "shards": all_shards,
                    "images": paginated_images,
                    "pagination": {
                        "offset": offset,
                        "limit": limit,
                        "total": len(all_images),
                        "hasNext": (offset + limit) < len(all_images),
                    },
                },
                status=200,
            )

    def post(self, request: Request, project: Project, snapshot_id: str) -> Response:
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
            from django.db import transaction

            from sentry.preprod.models import PreprodArtifact, SnapshotShards

            shard_info = data.get("shardInfo")
            preprod_artifact_id_str = data.get("preprodArtifactId")

            # Handle race conditions by using atomic transactions
            with transaction.atomic():
                if preprod_artifact_id_str:
                    # Use existing artifact if provided
                    try:
                        preprod_artifact_id = int(preprod_artifact_id_str)
                        preprod_artifact = PreprodArtifact.objects.get(
                            id=preprod_artifact_id, project=project
                        )
                    except (ValueError, PreprodArtifact.DoesNotExist):
                        return Response({"error": "Invalid preprodArtifactId"}, status=400)

                    # Ensure artifact has a SnapshotShards entry
                    if not preprod_artifact.extras or not preprod_artifact.extras.get(
                        "snapshot_shards_id"
                    ):
                        # Create SnapshotShards entry if it doesn't exist
                        if shard_info:
                            snapshot_shards, _ = SnapshotShards.objects.get_or_create(
                                shard_id=shard_info["shardId"],
                                defaults={"total_shards": shard_info["totalShards"]},
                            )
                        else:
                            # Create with default values
                            snapshot_shards = SnapshotShards.objects.create(
                                shard_id=f"artifact-{preprod_artifact_id}",
                                total_shards=0,
                            )

                        # Update artifact extras
                        if not preprod_artifact.extras:
                            preprod_artifact.extras = {}
                        preprod_artifact.extras["snapshot_shards_id"] = snapshot_shards.id
                        preprod_artifact.save(update_fields=["extras"])

                elif shard_info:
                    # No preprodArtifactId provided, but shard_info exists
                    # Check if SnapshotShards already exists for this shard_id
                    snapshot_shards, created = SnapshotShards.objects.get_or_create(
                        shard_id=shard_info["shardId"],
                        defaults={"total_shards": shard_info["totalShards"]},
                    )

                    # Look for existing PreprodArtifact that references this SnapshotShards
                    existing_artifact = PreprodArtifact.objects.filter(
                        project=project,
                        extras__snapshot_shards_id=snapshot_shards.id,
                    ).first()

                    if existing_artifact:
                        preprod_artifact = existing_artifact
                    else:
                        # Create new artifact linked to the SnapshotShards
                        preprod_artifact = PreprodArtifact.objects.create(
                            project=project,
                            state=PreprodArtifact.ArtifactState.UPLOADING,
                            extras={"snapshot_shards_id": snapshot_shards.id},
                        )
                else:
                    # No preprodArtifactId and no shard_info - create both with defaults
                    preprod_artifact = PreprodArtifact.objects.create(
                        project=project,
                        state=PreprodArtifact.ArtifactState.UPLOADING,
                    )

                    snapshot_shards = SnapshotShards.objects.create(
                        shard_id=f"artifact-{preprod_artifact.id}",
                        total_shards=0,
                    )

                    preprod_artifact.extras = {"snapshot_shards_id": snapshot_shards.id}
                    preprod_artifact.save(update_fields=["extras"])

                preprod_artifact_id = preprod_artifact.id

            # Determine shard index
            shard_index = shard_info["shardIndex"] if shard_info else 0

            # Store data in object store
            session = get_preprod_session(project.organization_id, project.id)
            shard_key = f"{project.organization_id}/{preprod_artifact_id}/shard-{shard_index}.json"

            try:
                session.put(orjson.dumps(data), key=shard_key)
            except RequestError as e:
                logger.exception(
                    "Failed to store snapshot shard in object store",
                    extra={
                        "project_id": project.id,
                        "organization_id": project.organization_id,
                        "preprod_artifact_id": preprod_artifact_id,
                        "shard_index": shard_index,
                        "error": str(e),
                    },
                )
                return Response({"error": "Failed to store snapshot data"}, status=500)

            logger.info(
                "Snapshot shard uploaded",
                extra={
                    "project_id": project.id,
                    "organization_id": project.organization_id,
                    "preprod_artifact_id": preprod_artifact_id,
                    "shard_index": shard_index,
                },
            )

        return Response(
            {
                "preprodArtifactId": str(preprod_artifact_id),
                "shardIndex": shard_index,
            },
            status=200,
        )
