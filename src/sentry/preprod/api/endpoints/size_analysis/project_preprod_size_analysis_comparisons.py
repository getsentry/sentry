from __future__ import annotations

import logging
from typing import Any

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


def _aggregate_state(states: list[int]) -> str:
    """Collapse the per-metric comparison states for a single base build into one label."""
    state_enum = PreprodArtifactSizeComparison.State
    if states and all(state == state_enum.SUCCESS for state in states):
        return "success"
    if any(state == state_enum.FAILED for state in states) and not any(
        state in (state_enum.PENDING, state_enum.PROCESSING) for state in states
    ):
        return "failed"
    return "processing"


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
        List existing size comparisons for which this build is the head.

        Returns one entry per base build the head has been compared against, most
        recent first, paginated the same way as the builds list. Accepts the same
        ``query`` search syntax as the builds endpoint, applied to the base builds.
        """
        cutoff = get_size_retention_cutoff(project.organization)
        if head_artifact.date_added < cutoff:
            return Response({"detail": "This build's size data has expired."}, status=404)

        head_metric_ids = list(
            PreprodArtifactSizeMetrics.objects.filter(
                preprod_artifact_id=head_artifact.id,
            ).values_list("id", flat=True)
        )

        # The base builds this head has been compared against (a small candidate set).
        candidate_base_ids = set(
            PreprodArtifactSizeComparison.objects.filter(
                organization_id=project.organization_id,
                head_size_analysis_id__in=head_metric_ids,
            ).values_list("base_size_analysis__preprod_artifact_id", flat=True)
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
            return Response({"detail": str(e)}, status=400)

        queryset = (
            PreprodArtifactSizeComparison.objects.filter(
                organization_id=project.organization_id,
                head_size_analysis_id__in=head_metric_ids,
                base_size_analysis__preprod_artifact_id__in=matching_base_ids,
            )
            .select_related(
                "base_size_analysis__preprod_artifact__mobile_app_info",
                "base_size_analysis__preprod_artifact__build_configuration",
                "base_size_analysis__preprod_artifact__commit_comparison",
                "base_size_analysis__preprod_artifact__project",
            )
            .prefetch_related(
                "base_size_analysis__preprod_artifact__preprodartifactsizemetrics_set",
            )
        )

        def on_results(
            comparisons: list[PreprodArtifactSizeComparison],
        ) -> list[dict[str, Any]]:
            # A head/base build pair has one comparison row per size-metric type, so
            # collapse this page's rows into one item per base build, preserving
            # their date-descending order.
            rows_by_base: dict[int, list[PreprodArtifactSizeComparison]] = {}
            base_order: list[int] = []
            for comparison in comparisons:
                base_artifact_id = comparison.base_size_analysis.preprod_artifact_id
                if base_artifact_id not in rows_by_base:
                    rows_by_base[base_artifact_id] = []
                    base_order.append(base_artifact_id)
                rows_by_base[base_artifact_id].append(comparison)

            results: list[dict[str, Any]] = []
            for base_artifact_id in base_order:
                rows = rows_by_base[base_artifact_id]
                base_artifact = rows[0].base_size_analysis.preprod_artifact
                try:
                    base_build_details = transform_preprod_artifact_to_build_details(base_artifact)
                except Exception:
                    logger.exception(
                        "preprod.size_analysis.comparisons.transform_failed",
                        extra={"base_artifact_id": base_artifact_id},
                    )
                    continue
                results.append(
                    SizeAnalysisComparisonListItem(
                        base_build_details=base_build_details,
                        state=_aggregate_state([row.state for row in rows]),
                        date_added=max(row.date_added for row in rows).isoformat(),
                    ).dict()
                )
            return results

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=on_results,
            paginator_cls=OffsetPaginator,
            default_per_page=25,
            max_per_page=100,
        )
