from rest_framework import serializers

from sentry.api.serializers.rest_framework.dashboard import DashboardWidgetQuerySerializer
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.dashboard_widget import DashboardWidget


class MetricsUsageAlertSerializer(serializers.Serializer):
    metricMRI = serializers.SerializerMethodField(read_only=True)
    alertRuleId = serializers.IntegerField(read_only=True, source="id")
    name = serializers.CharField(read_only=True)

    def get_metricMRI(self, obj: AlertRule) -> str:
        """Associates an alert with a metric MRI which it uses"""

        for metric_mri in self.context["metric_mris"]:
            if obj.snuba_query is not None and metric_mri in obj.snuba_query.aggregate:
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
