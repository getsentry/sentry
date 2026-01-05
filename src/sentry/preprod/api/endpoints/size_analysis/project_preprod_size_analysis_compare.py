from __future__ import annotations

import logging

from django.db import router, transaction
from django.http.response import HttpResponseBase
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.analytics import (
    PreprodArtifactApiSizeAnalysisCompareGetEvent,
    PreprodArtifactApiSizeAnalysisComparePostEvent,
)
from sentry.preprod.api.bases.preprod_artifact_endpoint import (
    PreprodArtifactEndpoint,
    ProjectPreprodArtifactPermission,
)
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.api.models.size_analysis.project_preprod_size_analysis_compare_models import (
    SizeAnalysisCompareGETResponse,
    SizeAnalysisComparePOSTResponse,
    SizeAnalysisComparison,
)
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.size_analysis.tasks import manual_size_analysis_comparison
from sentry.preprod.size_analysis.utils import build_size_metrics_map, can_compare_size_metrics

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactSizeAnalysisCompareEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectPreprodArtifactPermission,)

    def get(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        base_artifact_id: int,
        head_artifact: PreprodArtifact,
        base_artifact: PreprodArtifact,
    ) -> HttpResponseBase:
        """
        Get size analysis comparison results for a preprod artifact
        ````````````````````````````````````````````````````

        Get size analysis comparison results for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the head preprod artifact to get size analysis comparison for.
        :pparam string base_artifact_id: the ID of the base preprod artifact to get size analysis comparison for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisCompareGetEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                head_artifact_id=str(head_artifact_id),
                base_artifact_id=str(base_artifact_id),
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        logger.info(
            "preprod.size_analysis.compare.api.get",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )

        if head_artifact.project.id != project.id:
            return Response({"detail": "Project not found"}, status=404)

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        head_size_metrics = list(head_size_metrics_qs)

        if len(head_size_metrics) == 0:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} has no size metrics."},
                status=404,
            )

        if base_artifact.project.id != project.id:
            return Response({"detail": "Project not found"}, status=404)

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        base_size_metrics = list(base_size_metrics_qs)

        if len(base_size_metrics) == 0:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} has no size metrics."},
                status=404,
            )

        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        comparisons: list[SizeAnalysisComparison] = []
        for key, head_metric in head_metrics_map.items():
            base_metric = base_metrics_map.get(key)

            if not base_metric:
                logger.info(
                    "preprod.size_analysis.compare.api.get.no_matching_base_metric",
                    extra={"head_metric_id": head_metric.id},
                )
                # No matching base metric, so we can't compare
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=None,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        comparison_id=None,
                        error_code="NO_BASE_METRIC",
                        error_message="No matching base artifact size metric found.",
                    )
                )
                continue

            logger.info(
                "preprod.size_analysis.compare.api.get.metrics",
                extra={"head_metric": head_metric, "base_metric": base_metric},
            )

            # Try to find a comparison object
            try:
                comparison_obj = PreprodArtifactSizeComparison.objects.get(
                    head_size_analysis_id=head_metric.id,
                    base_size_analysis_id=base_metric.id,
                )
            except PreprodArtifactSizeComparison.DoesNotExist:
                logger.info(
                    "preprod.size_analysis.compare.api.get.no_comparison_obj",
                    extra={"head_metric_id": head_metric.id, "base_metric_id": base_metric.id},
                )
                continue

            logger.info(
                "preprod.size_analysis.compare.api.get.comparison_obj",
                extra={"comparison_obj": comparison_obj},
            )

            if comparison_obj.state == PreprodArtifactSizeComparison.State.SUCCESS:
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.SUCCESS,
                        comparison_id=comparison_obj.id,
                        error_code=None,
                        error_message=None,
                    )
                )
            elif comparison_obj.state == PreprodArtifactSizeComparison.State.FAILED:
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.FAILED,
                        comparison_id=comparison_obj.id,
                        error_code=(
                            str(comparison_obj.error_code)
                            if comparison_obj.error_code is not None
                            else None
                        ),
                        error_message=comparison_obj.error_message,
                    )
                )
            else:
                # Still processing or pending
                comparisons.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=head_metric.id,
                        base_size_metric_id=base_metric.id,
                        metrics_artifact_type=head_metric.metrics_artifact_type,
                        identifier=head_metric.identifier,
                        state=PreprodArtifactSizeComparison.State.PROCESSING,
                        comparison_id=comparison_obj.id,
                        error_code=None,
                        error_message=None,
                    )
                )

        logger.info(
            "preprod.size_analysis.compare.api.get.success",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "comparisons": len(comparisons),
            },
        )
        head_build_details = transform_preprod_artifact_to_build_details(head_artifact)
        base_build_details = transform_preprod_artifact_to_build_details(base_artifact)
        response = SizeAnalysisCompareGETResponse(
            head_build_details=head_build_details,
            base_build_details=base_build_details,
            comparisons=comparisons,
        )
        return Response(response.dict())

    def post(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        base_artifact_id: int,
        head_artifact: PreprodArtifact,
        base_artifact: PreprodArtifact,
    ) -> HttpResponseBase:
        """
        Trigger size analysis comparison for a preprod artifact
        ````````````````````````````````````````````````````

        Trigger size analysis comparison for a preprod artifact. Will run comparisons async for all size metrics.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string head_artifact_id: the ID of the head preprod artifact to trigger size analysis comparison for.
        :pparam string base_artifact_id: the ID of the base preprod artifact to trigger size analysis comparison for.
        :auth: required
        """

        analytics.record(
            PreprodArtifactApiSizeAnalysisComparePostEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                head_artifact_id=str(head_artifact_id),
                base_artifact_id=str(base_artifact_id),
            )
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        logger.info(
            "preprod.size_analysis.compare.api.post",
            extra={"head_artifact_id": head_artifact_id, "base_artifact_id": base_artifact_id},
        )

        if head_artifact.build_configuration != base_artifact.build_configuration:
            return Response(
                {"detail": "Head and base build configurations must be the same."}, status=400
            )

        head_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[head_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")

        if head_size_metrics_qs.count() == 0:
            return Response(
                {"detail": f"Head PreprodArtifact with id {head_artifact_id} has no size metrics."},
                status=404,
            )

        # Check if any of the size metrics are not completed
        if (
            head_size_metrics_qs.filter(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ).count()
            == 0
        ):
            body = SizeAnalysisComparePOSTResponse(
                status="processing",
                message=f"Head PreprodArtifact with id {head_artifact_id} has no completed size metrics yet. Size analysis may still be processing. Please try again later.",
            )
            return Response(
                body.dict(),
                status=202,  # Accepted, processing not complete
            )

        base_size_metrics_qs = PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact_id__in=[base_artifact.id],
            preprod_artifact__project=project,
        ).select_related("preprod_artifact")
        if base_size_metrics_qs.count() == 0:
            return Response(
                {"detail": f"Base PreprodArtifact with id {base_artifact_id} has no size metrics."},
                status=404,
            )

        if (
            base_size_metrics_qs.filter(
                state=PreprodArtifactSizeMetrics.SizeAnalysisState.COMPLETED
            ).count()
            == 0
        ):
            body = SizeAnalysisComparePOSTResponse(
                status="processing",
                message=f"Base PreprodArtifact with id {base_artifact_id} has no completed size metrics yet. Size analysis may still be processing. Please try again later.",
            )
            return Response(
                body.dict(),
                status=202,  # Accepted, processing not complete
            )

        head_size_metrics = list(head_size_metrics_qs)
        base_size_metrics = list(base_size_metrics_qs)

        # Check if the size metrics can be compared
        validation_result = can_compare_size_metrics(head_size_metrics, base_size_metrics)
        if not validation_result.can_compare:
            return Response(
                {"detail": validation_result.error_message},
                status=400,
            )

        existing_comparisons = PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis__in=head_size_metrics,
            base_size_analysis__in=base_size_metrics,
        )
        if existing_comparisons.exists():
            # Build SizeAnalysisComparison models for each existing comparison
            comparison_models = []
            for comparison in existing_comparisons:
                comparison_models.append(
                    SizeAnalysisComparison(
                        head_size_metric_id=comparison.head_size_analysis.id,
                        base_size_metric_id=comparison.base_size_analysis.id,
                        metrics_artifact_type=comparison.head_size_analysis.metrics_artifact_type,
                        identifier=comparison.head_size_analysis.identifier,
                        state=comparison.state,
                        comparison_id=(
                            comparison.id
                            if comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
                            else None
                        ),
                        error_code=(
                            str(comparison.error_code)
                            if comparison.state == PreprodArtifactSizeComparison.State.FAILED
                            and comparison.error_code is not None
                            else None
                        ),
                        error_message=(
                            comparison.error_message
                            if comparison.state == PreprodArtifactSizeComparison.State.FAILED
                            else None
                        ),
                    )
                )
            body = SizeAnalysisComparePOSTResponse(
                status="exists",
                message="A comparison already exists for the head and base size metrics.",
                comparisons=comparison_models,
            )
            return Response(body.dict(), status=200)

        logger.info(
            "preprod.size_analysis.compare.api.post.creating_pending_comparisons",
            extra={"head_artifact_id": head_artifact.id, "base_artifact_id": base_artifact.id},
        )

        # Create PENDING comparison records for each matching head/base metric pair
        head_metrics_map = build_size_metrics_map(head_size_metrics)
        base_metrics_map = build_size_metrics_map(base_size_metrics)

        created_comparisons = []
        with transaction.atomic(router.db_for_write(PreprodArtifactSizeComparison)):
            for key, head_metric in head_metrics_map.items():
                base_metric = base_metrics_map.get(key)
                if base_metric:
                    comparison = PreprodArtifactSizeComparison.objects.create(
                        head_size_analysis=head_metric,
                        base_size_analysis=base_metric,
                        organization_id=project.organization_id,
                        state=PreprodArtifactSizeComparison.State.PENDING,
                    )
                    comparison.save()

                    created_comparisons.append(
                        SizeAnalysisComparison(
                            head_size_metric_id=head_metric.id,
                            base_size_metric_id=base_metric.id,
                            metrics_artifact_type=head_metric.metrics_artifact_type,
                            identifier=head_metric.identifier,
                            state=PreprodArtifactSizeComparison.State.PENDING,
                            comparison_id=None,
                            error_code=None,
                            error_message=None,
                        )
                    )

        logger.info(
            "preprod.size_analysis.compare.api.post.running_comparison",
            extra={
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
                "pending_comparisons_count": len(created_comparisons),
            },
        )

        manual_size_analysis_comparison.apply_async(
            kwargs={
                "project_id": project.id,
                "org_id": project.organization_id,
                "head_artifact_id": head_artifact.id,
                "base_artifact_id": base_artifact.id,
            }
        )

        logger.info(
            "preprod.size_analysis.compare.api.post.success",
            extra={
                "head_artifact_id": head_artifact_id,
                "base_artifact_id": base_artifact_id,
                "created_comparisons_count": len(created_comparisons),
            },
        )

        body = SizeAnalysisComparePOSTResponse(
            status="created",
            message="Comparison records created and processing started.",
            comparisons=created_comparisons,
        )
        return Response(body.dict(), status=200)
