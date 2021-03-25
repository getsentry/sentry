from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetDisplayTypes,
)


@register(DashboardWidget)
class DashboardWidgetSerializer(Serializer):
    def __init__(self, collapse=None):
        self.collapse = collapse or []

    def get_attrs(self, item_list, user):
        result = {}

        if "queries" not in self.collapse:
            data_sources = serialize(
                list(
                    DashboardWidgetQuery.objects.filter(
                        widget_id__in=[i.id for i in item_list]
                    ).order_by("order")
                )
            )

            for widget in item_list:
                widget_data_sources = [d for d in data_sources if d["widgetId"] == str(widget.id)]
                result[widget] = {"queries": widget_data_sources}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        rv = {
            "id": str(obj.id),
            "title": obj.title,
            "displayType": DashboardWidgetDisplayTypes.get_type_name(obj.display_type),
            # Default value until a backfill can be done.
            "interval": str(obj.interval or "5m"),
            "dateCreated": obj.date_added,
            "dashboardId": str(obj.dashboard_id),
        }
        rv.update(attrs)
        return rv


@register(DashboardWidgetQuery)
class DashboardWidgetQuerySerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "name": obj.name,
            "fields": obj.fields,
            "conditions": str(obj.conditions),
            "orderby": str(obj.orderby),
            "widgetId": str(obj.widget_id),
        }


@register(Dashboard)
class DashboardSerializer(Serializer):
    def __init__(self, collapse=None):
        self.collapse = collapse or []

    def get_attrs(self, item_list, user):
        result = {}

        if "widgets" not in self.collapse:
            widgets = serialize(
                list(
                    DashboardWidget.objects.filter(
                        dashboard_id__in=[i.id for i in item_list]
                    ).order_by("order")
                ),
                serializer=DashboardWidgetSerializer(collapse=self.collapse),
            )

            for dashboard in item_list:
                dashboard_widgets = [w for w in widgets if w["dashboardId"] == str(dashboard.id)]
                result[dashboard] = {"widgets": dashboard_widgets}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
        }
        if "createdBy" not in self.collapse:
            data["createdBy"] = serialize(obj.created_by)
        data.update(attrs)
        return data
