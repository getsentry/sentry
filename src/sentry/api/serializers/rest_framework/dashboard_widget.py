from __future__ import absolute_import

from django.db.models import Max
from rest_framework import serializers

from sentry.api.serializers.rest_framework import ListField
from sentry.models import DashboardWidget, DashboardWidgetDisplayTypes


def get_next_dashboard_order(dashboard_id):
    max_order = DashboardWidget.objects.filter(dashboard_id=dashboard_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


class DashboardWidgetQuerySerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    fields = ListField(child=serializers.CharField(), required=True)
    conditions = serializers.CharField(required=True)
    interval = serializers.CharField()

    # TODO validate fields, conditions and interval values.


class DashboardWidgetSerializer(serializers.Serializer):
    title = serializers.CharField(required=True)
    displayType = serializers.ChoiceField(
        choices=DashboardWidgetDisplayTypes.as_text_choices(), required=True
    )
    queries = ListField(
        child=DashboardWidgetQuerySerializer(required=False), required=False, allow_null=True
    )

    def validate_displayType(self, display_type):
        return DashboardWidgetDisplayTypes.get_id_for_type_name(display_type)
