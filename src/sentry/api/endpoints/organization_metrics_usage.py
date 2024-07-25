from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers.rest_framework.dashboard import DashboardWidgetQuerySerializer
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.dashboard_widget import DashboardWidget
from sentry.models.organization import Organization


class MetricsUsageAlertSerializer(serializers.Serializer):
    metricMRI = serializers.SerializerMethodField(read_only=True)
    alertRuleId = serializers.IntegerField(read_only=True, source="id")
    name = serializers.CharField(read_only=True)

    def get_metricMRI(self, obj: AlertRule) -> str:
        """Associates an alert with a metric MRI which it uses"""

        for metric_mri in self.context["metric_mris"]:
            if metric_mri in obj.snuba_query.aggregate:
                return metric_mri

        # this should never happen
        raise Exception("Metric MRI not found in alert rule")


class MetricsUsageWidgetSerializer(serializers.Serializer):
    metricMRI = serializers.SerializerMethodField(read_only=True)
    widgetId = serializers.IntegerField(read_only=True, source="id")
    dashboardId = serializers.IntegerField(read_only=True, source="dashboard_id")
    title = serializers.CharField(read_only=True)
    queries = DashboardWidgetQuerySerializer(
        many=True, read_only=True, source="dashboardwidgetquery_set"
    )

    def get_metricMRI(self, obj: DashboardWidget) -> str:
        """Associates a widget with a metric MRI which it uses"""

        # this won't hit the database since it was prefetched
        widget_queries = obj.dashboardwidgetquery_set.all()
        # collects all aggregates from all widget queries into a single list
        all_aggregates = [
            agg for query in widget_queries for agg in query.aggregates  # type: ignore[union-attr]
        ]
        for metric_mri in self.context["metric_mris"]:
            for aggregate in all_aggregates:
                if metric_mri in aggregate:
                    return metric_mri

        # this should never happen
        raise Exception("Metric MRI not found in widget")


@region_silo_endpoint
class OrganizationMetricsUsageEndpoint(OrganizationEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve the metric usage inside the organization
        """

        metric_mris = request.GET.getlist("metricMRIs", [])
        if not metric_mris:
            return Response({"detail": "At least one metric_mri is required"}, status=400)

        alert_rules = (
            AlertRule.objects.get_for_metrics(organization, metric_mris)
            .order_by("id")
            .select_related("snuba_query")
        )
        alerts_serialized = MetricsUsageAlertSerializer(
            alert_rules, many=True, context={"metric_mris": metric_mris}
        )
        widgets = (
            DashboardWidget.objects.get_for_metrics(organization, metric_mris)
            .order_by("id")
            .prefetch_related("dashboardwidgetquery_set")
        )
        widgets_serialized = MetricsUsageWidgetSerializer(
            widgets, many=True, context={"metric_mris": metric_mris}
        )

        return Response({"alerts": alerts_serialized.data, "widgets": widgets_serialized.data})
