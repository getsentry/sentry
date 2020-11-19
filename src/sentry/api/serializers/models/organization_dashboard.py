from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetDisplayTypes,
)


@register(DashboardWidget)
class DashboardWidgetSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}
        data_sources = serialize(
            list(
                DashboardWidgetQuery.objects.filter(
                    widget_id__in=[i.id for i in item_list]
                ).order_by("order")
            )
        )

        for widget in item_list:
            widget_data_sources = [
                d for d in data_sources if d["widgetId"] == six.text_type(widget.id)
            ]
            result[widget] = {"queries": widget_data_sources}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": six.text_type(obj.id),
            "title": obj.title,
            "displayType": DashboardWidgetDisplayTypes.get_type_name(obj.display_type),
            "dateCreated": obj.date_added,
            "dashboardId": six.text_type(obj.dashboard_id),
            "queries": attrs["queries"],
        }


@register(DashboardWidgetQuery)
class DashboardWidgetQuerySerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "fields": obj.fields,
            "conditions": six.text_type(obj.conditions),
            "interval": six.text_type(obj.interval),
            "widgetId": six.text_type(obj.widget_id),
        }


@register(Dashboard)
class DashboardWithWidgetsSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}

        widgets = serialize(
            list(
                DashboardWidget.objects.filter(dashboard_id__in=[i.id for i in item_list]).order_by(
                    "order"
                )
            )
        )

        for dashboard in item_list:
            dashboard_widgets = [
                w for w in widgets if w["dashboardId"] == six.text_type(dashboard.id)
            ]
            result[dashboard] = {"widgets": dashboard_widgets}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": six.text_type(obj.id),
            "title": obj.title,
            "organization": six.text_type(obj.organization.id),
            "dateCreated": obj.date_added,
            "createdBy": six.text_type(obj.created_by.id),
            "widgets": attrs["widgets"],
        }
        return data
