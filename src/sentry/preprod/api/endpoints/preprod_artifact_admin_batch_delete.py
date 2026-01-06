from __future__ import annotations

import logging

import orjson
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import StaffPermission
from sentry.preprod.analytics import PreprodArtifactApiAdminBatchDeleteEvent
from sentry.preprod.helpers.deletion import delete_artifacts_and_eap_data
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodArtifactAdminBatchDeleteEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (StaffPermission,)
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def delete(self, request: Request) -> Response:
        """
        Batch delete multiple preprod artifacts
        ````````````````````````````````````````

        Admin endpoint to delete all associated data for multiple preprod artifacts.
        This endpoint requires superuser privileges.

        This is a destructive operation that will permanently delete for each artifact:
        - The artifact record
        - All associated files
        - All related metadata

        :auth: required (superuser)
        """
        try:
            data = orjson.loads(request.body)
        except (orjson.JSONDecodeError, TypeError):
            return Response({"error": "Invalid JSON body"}, status=400)

        preprod_artifact_ids = data.get("preprod_artifact_ids")
        if not preprod_artifact_ids:
            return Response({"error": "preprod_artifact_ids is required"}, status=400)

        if not isinstance(preprod_artifact_ids, list):
            return Response({"error": "preprod_artifact_ids must be an array"}, status=400)

        try:
            preprod_artifact_ids = [int(id_val) for id_val in preprod_artifact_ids]
        except (ValueError, TypeError):
            return Response(
                {"error": "preprod_artifact_ids must contain valid integers"}, status=400
            )

        # Limit batch size for safety
        if len(preprod_artifact_ids) > 100:
            return Response({"error": "Cannot delete more than 100 artifacts at once"}, status=400)

        # Get all artifacts to be deleted
        artifacts_to_delete = list(
            PreprodArtifact.objects.select_related("project", "project__organization").filter(
                id__in=preprod_artifact_ids
            )
        )

        if not artifacts_to_delete:
            return Response({"error": "No artifacts found with the provided IDs"}, status=404)

        # Log analytics event (using the first artifact's organization/project for analytics)
        first_artifact = artifacts_to_delete[0]
        analytics.record(
            PreprodArtifactApiAdminBatchDeleteEvent(
                organization_id=first_artifact.project.organization_id,
                project_id=first_artifact.project.id,
                user_id=request.user.id,
                artifact_count=len(artifacts_to_delete),
            )
        )

        try:
            result = delete_artifacts_and_eap_data(artifacts_to_delete)
            return Response(
                {
                    "success": True,
                    "message": f"Successfully deleted {result.artifacts_deleted} artifacts.",
                    "artifact_ids": [str(artifact.id) for artifact in artifacts_to_delete],
                    "files_deleted": result.files_deleted,
                    "size_metrics_deleted": result.size_metrics_deleted,
                    "installable_artifacts_deleted": result.installable_artifacts_deleted,
                }
            )

        except Exception as e:
            logger.exception(
                "preprod_artifact.admin_batch_delete.artifacts_delete_failed",
                extra={
                    "artifact_ids": preprod_artifact_ids,
                    "user_id": request.user.id,
                    "error": str(e),
                },
            )
            return Response(
                {"success": False, "error": "Internal error deleting artifacts."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
