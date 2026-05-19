from __future__ import annotations

import logging
from datetime import datetime, timezone

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationReleasePermission,
)
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.vcs.status_checks.size.tasks import create_preprod_status_check_task
from sentry.preprod.vcs.tasks import update_preprod_snapshot_vcs

logger = logging.getLogger(__name__)

FEATURE_TYPE_MAP = {
    "snapshots": PreprodComparisonApproval.FeatureType.SNAPSHOTS,
    "size": PreprodComparisonApproval.FeatureType.SIZE,
}


@cell_silo_endpoint
class OrganizationPreprodArtifactApproveEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationReleasePermission,)

    def post(self, request: Request, organization: Organization, artifact_id: str) -> Response:
        feature_type_str = request.data.get("feature_type")
        if feature_type_str not in FEATURE_TYPE_MAP:
            return Response(
                {"detail": f"feature_type must be one of: {', '.join(FEATURE_TYPE_MAP.keys())}"},
                status=400,
            )

        feature_type = FEATURE_TYPE_MAP[feature_type_str]

        try:
            artifact = PreprodArtifact.objects.get(
                id=artifact_id,
                project__organization_id=organization.id,
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Artifact not found"}, status=404)

        if not request.access.has_project_access(artifact.project) and not is_active_staff(request):
            return Response({"detail": "Artifact not found"}, status=404)

        # exists()+create() instead of get_or_create — no unique constraint on this model
        # (see snapshots/tasks.py for rationale)
        already_approved = PreprodComparisonApproval.objects.filter(
            preprod_artifact=artifact,
            preprod_feature_type=feature_type,
            approved_by_id=request.user.id,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        ).exists()

        if already_approved:
            return Response({"detail": "Already approved"}, status=200)

        PreprodComparisonApproval.objects.create(
            preprod_artifact=artifact,
            preprod_feature_type=feature_type,
            approved_by_id=request.user.id,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
        )

        PreprodComparisonApproval.objects.filter(
            preprod_artifact=artifact,
            preprod_feature_type=feature_type,
            approval_status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL,
        ).delete()

        if feature_type == PreprodComparisonApproval.FeatureType.SNAPSHOTS:
            update_preprod_snapshot_vcs(preprod_artifact_id=artifact.id, caller="approval_endpoint")
        elif feature_type == PreprodComparisonApproval.FeatureType.SIZE:
            create_preprod_status_check_task(
                preprod_artifact_id=artifact.id, caller="approval_endpoint"
            )

        return Response({"detail": "Approved"}, status=201)
