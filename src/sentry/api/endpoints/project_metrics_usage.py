from django.shortcuts import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers.rest_framework.metrics_usage import (
    MetricsUsageAlertSerializer,
    MetricsUsageWidgetSerializer,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.dashboard_widget import DashboardWidget
from sentry.models.project import Project
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig


@region_silo_endpoint
class ProjectMetricsUsageEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, span_attribute: str) -> Response:
        """
        Retrieve the metrics usage inside the organization based on the span attribute extraction rule.
        """

        span_extraction_rule_config = get_object_or_404(
            SpanAttributeExtractionRuleConfig,
            span_attribute=span_attribute,
            project=project,
        )
        metric_mris = []
        for condition in span_extraction_rule_config.conditions.all():
            metric_mris.extend(condition.generate_mris())

        alert_rules = (
            AlertRule.objects.get_for_metrics(project.organization, metric_mris)
            .order_by("id")
            .select_related("snuba_query")
        )
        alerts_serialized = MetricsUsageAlertSerializer(
            alert_rules, many=True, context={"metric_mris": metric_mris}
        )
        widgets = (
            DashboardWidget.objects.get_for_metrics(project.organization, metric_mris)
            .order_by("id")
            .select_related("dashboard")
            .prefetch_related("dashboardwidgetquery_set")
        )
        widgets_serialized = MetricsUsageWidgetSerializer(
            widgets, many=True, context={"metric_mris": metric_mris}
        )

        return Response({"alerts": alerts_serialized.data, "widgets": widgets_serialized.data})
