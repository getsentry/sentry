from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import (
    SpanAttributeExtractionRuleConfigSerializer,
)
from sentry.models.organization import Organization
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig


@region_silo_endpoint
class OrganizationMetricsExtractionRulesEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def has_feature(self, organization: Organization, request: Request) -> bool:
        return features.has(
            "organizations:custom-metrics-extraction-rule", organization, actor=request.user
        )

    def get(self, request: Request, organization: Organization) -> Response:
        """GET extraction rules for a list of projects. Returns 200 and a list of extraction rules on success."""
        if not self.has_feature(organization, request):
            return Response(status=404)

        projects = self.get_projects(request, organization)

        if not projects:
            return Response(
                {"detail": "You must supply at least one project to see its metrics"}, status=404
            )

        query = request.GET.get("query")

        try:
            configs = SpanAttributeExtractionRuleConfig.objects.filter(project__in=projects)
            if query:
                configs = configs.filter(span_attribute__icontains=query)

        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return self.paginate(
            request,
            queryset=configs,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, user=request.user, serializer=SpanAttributeExtractionRuleConfigSerializer()
            ),
            default_per_page=1000,
            max_per_page=1000,
            max_limit=1000,  # overrides default max_limit of 100 when creating paginator object
        )
