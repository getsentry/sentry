from __future__ import annotations

import logging
from typing import Any

from django.db.models import OuterRef, Subquery
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactEndpoint,
    ProjectPreprodArtifactPermission,
)
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisComparisonListItem,
)
from sentry.preprod.builds_query import filtered_builds_queryset
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.quotas import get_size_retention_cutoff

logger = logging.getLogger(__name__)


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
        each base's most recent successful comparison (newest first), and paginated like
        the builds list (25/100). Accepts the same ``query`` search syntax as the builds
        endpoint, applied to the base builds.
        """
        cutoff = get_size_retention_cutoff(project.organization)
        if head_artifact.date_added < cutoff:
            return Response({"detail": "This build's size data has expired."}, status=404)

        head_metric_ids = list(
            PreprodArtifactSizeMetrics.objects.filter(
                preprod_artifact_id=head_artifact.id,
            ).values_list("id", flat=True)
        )

        # All successful comparisons where this build is the head. Reused for both the
        # candidate base set and the per-base "latest comparison" annotation below, so
        # the two always apply the same filters.
        head_success_comparisons = PreprodArtifactSizeComparison.objects.filter(
            organization_id=project.organization_id,
            head_size_analysis_id__in=head_metric_ids,
            state=PreprodArtifactSizeComparison.State.SUCCESS,
        )

        # The base builds this head has a successful comparison against (a small
        # candidate set), used to constrain the search query below.
        candidate_base_ids = set(
            head_success_comparisons.values_list(
                "base_size_analysis__preprod_artifact_id", flat=True
            )
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
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        # Paginate over the distinct base builds rather than the per-metric comparison
        # rows (a head/base pair has one row per size-metric type), so page sizes are
        # stable and a base build can't straddle a page boundary. Order each base by its
        # most recent successful comparison with this head, with a stable id tiebreaker.
        latest_comparison_date = (
            head_success_comparisons.filter(
                base_size_analysis__preprod_artifact_id=OuterRef("pk"),
            )
            .order_by("-date_added")
            .values("date_added")[:1]
        )

        # project_id is also enforced via filtered_builds_queryset above; this keeps the
        # project boundary on the returned bases explicit at the data layer.
        queryset = (
            PreprodArtifact.objects.filter(
                id__in=matching_base_ids,
                project_id=project.id,
            )
            .annotate(comparison_date_added=Subquery(latest_comparison_date))
            # Exclude bases whose successful comparison was deleted between the candidate
            # query and this one (the subquery would annotate to NULL), so the date is
            # always present and ordering stays well-defined.
            .filter(comparison_date_added__isnull=False)
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

        def on_results(artifacts: list[PreprodArtifact]) -> list[dict[str, Any]]:
            results: list[dict[str, Any]] = []
            for artifact in artifacts:
                try:
                    base_build_details = transform_preprod_artifact_to_build_details(artifact)
                except Exception:
                    logger.exception(
                        "preprod.size_analysis.comparisons.transform_failed",
                        extra={"base_artifact_id": artifact.id},
                    )
                    continue
                results.append(
                    SizeAnalysisComparisonListItem(
                        base_build_details=base_build_details,
                        date_added=artifact.comparison_date_added.isoformat(),  # type: ignore[attr-defined]
                    ).dict()
                )
            return results

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=["-comparison_date_added", "-id"],
            on_results=on_results,
            paginator_cls=OffsetPaginator,
            default_per_page=25,
            max_per_page=100,
        )
