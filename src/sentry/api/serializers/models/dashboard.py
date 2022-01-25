from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.utils import json


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
            widget_data_sources = [d for d in data_sources if d["widgetId"] == str(widget.id)]
            result[widget] = {"queries": widget_data_sources}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "title": obj.title,
            "displayType": DashboardWidgetDisplayTypes.get_type_name(obj.display_type),
            # Default value until a backfill can be done.
            "interval": str(obj.interval or "5m"),
            "dateCreated": obj.date_added,
            "dashboardId": str(obj.dashboard_id),
            "queries": attrs["queries"],
            # Default to discover type if null
            "widgetType": DashboardWidgetTypes.get_type_name(obj.widget_type)
            or DashboardWidgetTypes.TYPE_NAMES[0],
            "layout": obj.detail.get("layout") if obj.detail else None,
        }


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


class DashboardListSerializer(Serializer):
    def get_attrs(self, item_list, user):
        item_dict = {i.id: i for i in item_list}

        widgets = list(
            DashboardWidget.objects.filter(dashboard_id__in=item_dict.keys())
            .order_by("order")
            .values_list("dashboard_id", "order", "display_type", "detail", "id")
        )

        result = defaultdict(lambda: {"widget_display": [], "layout": []})
        for dashboard_id, _, display_type, _, _ in widgets:
            dashboard = item_dict[dashboard_id]
            display_type = DashboardWidgetDisplayTypes.get_type_name(display_type)
            result[dashboard]["widget_display"].append(display_type)

        # TODO: feature flag
        for dashboard_id, _, display_type, detail, widget_id in widgets:
            dashboard = item_dict[dashboard_id]
            if detail:
                blah = json.loads(detail)
                if blah.get("layout"):
                    result[dashboard]["layout"].append(
                        {
                            **blah.get("layout"),
                            "i": f"grid-item-{widget_id}",
                            "displayType": DashboardWidgetDisplayTypes.get_type_name(display_type),
                        }
                    )

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": serialize(obj.created_by, serializer=UserSerializer()),
            "widgetDisplay": attrs.get("widget_display", []),
            "layout": attrs.get("layout", []),
        }
        return data


@register(Dashboard)
class DashboardDetailsSerializer(Serializer):
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
            dashboard_widgets = [w for w in widgets if w["dashboardId"] == str(dashboard.id)]
            result[dashboard] = {"widgets": dashboard_widgets}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": serialize(obj.created_by, serializer=UserSerializer()),
            "widgets": attrs["widgets"],
        }
        return data
