import logging
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.preprod.api.models.project_preprod_build_details_models import (
    transform_preprod_artifact_to_build_details,
)
from sentry.preprod.artifact_search import queryset_for_query
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.quotas import get_size_retention_cutoff

logger = logging.getLogger(__name__)

ERR_FEATURE_REQUIRED = "Feature {} is not enabled for the organization."


@region_silo_endpoint
class BuildsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:preprod-frontend-routes", organization, actor=request.user
        ):
            return Response(
                {"detail": ERR_FEATURE_REQUIRED.format("organizations:preprod-frontend-routes")},
                status=403,
            )

        def on_results(artifacts: list[PreprodArtifact]) -> list[dict[str, Any]]:
            results = []
            for artifact in artifacts:
                try:
                    results.append(transform_preprod_artifact_to_build_details(artifact).dict())
                except Exception:
                    logger.warning(
                        "preprod.builds.transform_failed", extra={"artifact_id": artifact.id}
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

        start = params["start"]
        end = params["end"]
        # Builds don't have environments so we ignore environments from
        # params on purpose.

        query = request.GET.get("query", "").strip()
        cutoff = get_size_retention_cutoff(organization)

        try:
            queryset = queryset_for_query(query, organization)
            queryset = queryset.select_related(
                "project", "build_configuration", "commit_comparison", "mobile_app_info"
            ).prefetch_related("preprodartifactsizemetrics_set")
            queryset = queryset.filter(date_added__gte=cutoff)
            if start:
                queryset = queryset.filter(date_added__gte=start)
            if end:
                queryset = queryset.filter(date_added__lte=end)
            queryset = queryset.filter(project_id__in=params["project_id"])

            display = request.GET.get("display")
            if display in ("size", "distribution"):
                queryset = queryset.filter(preprodsnapshotmetrics__isnull=True)
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        return paginate(queryset)
