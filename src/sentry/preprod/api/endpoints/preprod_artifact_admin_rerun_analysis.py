import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.preprod.analytics import PreprodArtifactApiRerunAnalysisEvent
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.producer import produce_preprod_artifact_to_kafka

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodArtifactAdminRerunAnalysisEndpoint(Endpoint):
    owner = ApiOwner.EMERGE_TOOLS
    permission_classes = (SuperuserPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request) -> Response:
        """
        Rerun analysis for a preprod artifact
        ```````````````````````````````````

        Admin endpoint to rerun analysis for a specific preprod artifact.
        This endpoint requires superuser privileges.

        :auth: required (superuser)
        """

        try:
            data = orjson.loads(request.body)
        except (orjson.JSONDecodeError, TypeError):
            return Response({"error": "Invalid JSON body"}, status=400)

        preprod_artifact_id = data.get("preprod_artifact_id")
        try:
            preprod_artifact_id_int = int(preprod_artifact_id)
        except ValueError:
            return Response(
                {"error": f"Invalid preprod artifact ID: {preprod_artifact_id}"}, status=400
            )

        if not preprod_artifact_id:
            return Response({"error": "preprod_artifact_id is required"}, status=400)

        try:
            preprod_artifact = PreprodArtifact.objects.get(id=preprod_artifact_id_int)
        except PreprodArtifact.DoesNotExist:
            return Response(
                {"error": f"Preprod artifact {preprod_artifact_id} not found"}, status=404
            )

        analytics.record(
            PreprodArtifactApiRerunAnalysisEvent(
                organization_id=preprod_artifact.project.organization_id,
                project_id=preprod_artifact.project.id,
                user_id=request.user.id,
                artifact_id=preprod_artifact_id,
            )
        )

        preprod_artifact.state = PreprodArtifact.ArtifactState.UPLOADED
        preprod_artifact.error_code = None
        preprod_artifact.error_message = None
        preprod_artifact.save(
            update_fields=["state", "error_code", "error_message", "date_updated"]
        )

        try:
            produce_preprod_artifact_to_kafka(
                project_id=preprod_artifact.project.id,
                organization_id=preprod_artifact.project.organization_id,
                artifact_id=preprod_artifact_id_int,
            )
        except Exception as e:
            logger.exception(
                "preprod_artifact.admin_rerun_analysis.kafka_error",
                extra={
                    "artifact_id": preprod_artifact_id,
                    "user_id": request.user.id,
                    "organization_id": preprod_artifact.project.organization_id,
                    "project_id": preprod_artifact.project.id,
                    "error": str(e),
                },
            )
            return Response(
                {
                    "error": f"Failed to queue analysis for artifact {preprod_artifact_id}",
                },
                status=500,
            )

        logger.info(
            "preprod_artifact.admin_rerun_analysis",
            extra={
                "artifact_id": preprod_artifact_id,
                "user_id": request.user.id,
                "organization_id": preprod_artifact.project.organization_id,
                "project_id": preprod_artifact.project.id,
            },
        )

        return Response(
            {
                "success": True,
                "artifact_id": preprod_artifact_id,
                "message": f"Analysis rerun initiated for artifact {preprod_artifact_id}",
                "new_state": preprod_artifact.state,
            }
        )
