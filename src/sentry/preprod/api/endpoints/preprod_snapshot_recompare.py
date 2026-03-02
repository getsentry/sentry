from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.permissions import StaffPermission
from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.tasks import compare_snapshots
from sentry.preprod.snapshots.utils import find_base_snapshot_artifact

logger = logging.getLogger(__name__)


@region_silo_endpoint
class PreprodSnapshotRecompareEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (StaffPermission,)

    def post(self, request: Request, organization: Organization, snapshot_id: str) -> Response:
        try:
            artifact = PreprodArtifact.objects.select_related("commit_comparison").get(
                id=snapshot_id, project__organization_id=organization.id
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            snapshot_metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        existing_comparison = (
            PreprodSnapshotComparison.objects.select_related(
                "base_snapshot_metrics",
            )
            .filter(head_snapshot_metrics=snapshot_metrics)
            .order_by("-id")
            .first()
        )

        base_artifact_id = None

        if existing_comparison:
            base_artifact_id = existing_comparison.base_snapshot_metrics.preprod_artifact_id
            existing_comparison.delete()
        else:
            commit_comparison = artifact.commit_comparison
            if not commit_comparison:
                return Response({"detail": "No VCS info available to find base"}, status=400)

            base_sha = commit_comparison.base_sha
            base_repo_name = commit_comparison.base_repo_name

            if not (base_sha and base_repo_name):
                return Response({"detail": "Incomplete VCS info to find base"}, status=400)

            base_artifact = find_base_snapshot_artifact(
                organization_id=organization.id,
                base_sha=base_sha,
                base_repo_name=base_repo_name,
                project_id=artifact.project_id,
                app_id=artifact.app_id,
                artifact_type=artifact.artifact_type,
                build_configuration=artifact.build_configuration,
            )
            if not base_artifact:
                return Response({"detail": "No base artifact found"}, status=404)
            base_artifact_id = base_artifact.id

        logger.info(
            "Recompare: dispatching compare_snapshots task",
            extra={
                "head_artifact_id": artifact.id,
                "base_artifact_id": base_artifact_id,
                "org_id": organization.id,
            },
        )

        compare_snapshots.apply_async(
            kwargs={
                "project_id": artifact.project_id,
                "org_id": organization.id,
                "head_artifact_id": artifact.id,
                "base_artifact_id": base_artifact_id,
            },
        )

        return Response({"status": "queued"}, status=200)
