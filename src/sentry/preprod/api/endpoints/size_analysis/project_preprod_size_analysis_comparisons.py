from __future__ import annotations

import logging

from django.db.models import OuterRef, Subquery
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactEndpoint,
    ProjectPreprodArtifactPermission,
)
from sentry.preprod.api.models.project_preprod_build_details_models import (
    BuildDetailsApiResponse,
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisComparisonsResponse,
)
from sentry.preprod.builds_query import filtered_builds_queryset
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeComparison
from sentry.preprod.quotas import get_size_retention_cutoff

logger = logging.getLogger(__name__)

MAX_COMPARISONS = 20


@cell_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisComparisonsEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectPreprodArtifactPermission,)

    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: str,
        head_artifact: PreprodArtifact,
    ) -> Response:
        """
        List existing successful size comparisons for which this build is the head.

        Returns one entry per base build the head has been compared against, ordered by
        each base's most recent successful comparison (newest first) and capped at
        ``MAX_COMPARISONS``. Accepts the same ``query`` search syntax as the builds
        endpoint, applied to the base builds.
        """
        cutoff = get_size_retention_cutoff(project.organization)
        if head_artifact.date_added < cutoff:
            return Response({"detail": "This build's size data has expired."}, status=404)

        head_success_comparisons = PreprodArtifactSizeComparison.objects.filter(
            organization_id=project.organization_id,
            head_size_analysis__preprod_artifact_id=head_artifact.id,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        candidate_base_ids = head_success_comparisons.values_list(
            "base_size_analysis__preprod_artifact_id", flat=True
        )

        # Apply the same search query the builds list uses, but only over the base
        # builds this head was actually compared against.
        query = request.GET.get("query", "").strip()
        try:
            matching_base_ids = set(
                filtered_builds_queryset(
                    organization=project.organization,
                    query=query,
                    display=None,
                    project_ids=[project.id],
                    start=None,
                    end=None,
                )
                .filter(id__in=candidate_base_ids)
                .values_list("id", flat=True)
            )
        except InvalidSearchQuery:
            # TODO: centralize the repeated InvalidSearchQuery response handling
            logger.exception(
                "preprod.size_analysis.comparisons.invalid_search_query",
                extra={
                    "project_id": project.id,
                    "head_artifact_id": head_artifact.id,
                    "query": query,
                },
            )
            return Response({"detail": "Invalid search query."}, status=400)

        latest_comparison_date = (
            head_success_comparisons.filter(
                base_size_analysis__preprod_artifact_id=OuterRef("pk"),
            )
            .order_by("-date_added")
            .values("date_added")[:1]
        )

        queryset = (
            PreprodArtifact.objects.get_queryset()
            .annotate_download_count()  # avoids N+1
            .filter(
                id__in=matching_base_ids,
                project_id=project.id,
            )
            .annotate(comparison_date_added=Subquery(latest_comparison_date))
            .filter(comparison_date_added__isnull=False)
            .order_by("-comparison_date_added", "-id")
            .select_related(
                "project",
                "build_configuration",
                "commit_comparison",
                "mobile_app_info",
                "preprodsnapshotmetrics",
            )
            .prefetch_related(
                "preprodartifactsizemetrics_set",
                "preprodsnapshotmetrics__snapshot_comparisons_head_metrics",
                "preprodcomparisonapproval_set",
            )
        )

        comparisons: list[BuildDetailsApiResponse] = []
        for artifact in queryset[:MAX_COMPARISONS]:
            try:
                comparisons.append(transform_preprod_artifact_to_build_details(artifact))
            except Exception:
                logger.exception(
                    "preprod.size_analysis.comparisons.transform_failed",
                    extra={"base_artifact_id": artifact.id},
                )
                continue

        return Response(SizeAnalysisComparisonsResponse(comparisons=comparisons).dict())
