import logging
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.builds_query import filtered_builds_queryset
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class BuildsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        def on_results(artifacts: list[PreprodArtifact]) -> list[dict[str, Any]]:
            results = []
            for artifact in artifacts:
                try:
                    results.append(transform_preprod_artifact_to_build_details(artifact).dict())
                except Exception:
                    logger.exception(
                        "preprod.builds.transform_failed",
                        extra={"preprod_artifact_id": artifact.id},
                    )
            return results

        paginate = lambda queryset: self.paginate(
            order_by="-date_added",
            request=request,
            queryset=queryset,
            on_results=on_results,
            paginator_cls=OffsetPaginator,
            default_per_page=25,
            max_per_page=100,
        )

        try:
            params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            return paginate(PreprodArtifact.objects.none())

        # Builds don't have environments so we ignore environments from
        # params on purpose.
        query = request.GET.get("query", "").strip()
        display = request.GET.get("display")

        try:
            queryset = filtered_builds_queryset(
                organization=organization,
                query=query,
                display=display,
                project_ids=params["project_id"],
                start=params["start"],
                end=params["end"],
            )
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        queryset = queryset.select_related(
            "project",
            "build_configuration",
            "commit_comparison",
            "mobile_app_info",
            "preprodsnapshotmetrics",
        ).prefetch_related(
            "preprodartifactsizemetrics_set",
            "preprodsnapshotmetrics__snapshot_comparisons_head_metrics",
            "preprodcomparisonapproval_set",
        )

        return paginate(queryset)
