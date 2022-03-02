from collections import defaultdict

from django.db.models.query import prefetch_related_objects

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
            "aggregates": obj.aggregates,
            "columns": obj.columns,
            "conditions": str(obj.conditions),
            "orderby": str(obj.orderby),
            "widgetId": str(obj.widget_id),
        }


class DashboardListSerializer(Serializer):
    def get_attrs(self, item_list, user):
        item_dict = {i.id: i for i in item_list}
        prefetch_related_objects(item_list, "created_by")

        widgets = (
            DashboardWidget.objects.filter(dashboard_id__in=item_dict.keys())
            .order_by("order")
            .values("dashboard_id", "order", "display_type", "detail", "id")
        )

        result = defaultdict(lambda: {"widget_display": [], "widget_preview": [], "created_by": {}})
        for widget in widgets:
            dashboard = item_dict[widget["dashboard_id"]]
            display_type = DashboardWidgetDisplayTypes.get_type_name(widget["display_type"])
            result[dashboard]["widget_display"].append(display_type)

        for widget in widgets:
            dashboard = item_dict[widget["dashboard_id"]]
            widget_preview = {
                "displayType": DashboardWidgetDisplayTypes.get_type_name(widget["display_type"]),
                "layout": None,
            }
            if widget.get("detail"):
                detail = json.loads(widget["detail"])
                if detail.get("layout"):
                    widget_preview["layout"] = detail["layout"]

            result[dashboard]["widget_preview"].append(widget_preview)

        user_serializer = UserSerializer()
        serialized_users = {
            user["id"]: user
            for user in serialize(
                [dashboard.created_by for dashboard in item_list if dashboard.created_by],
                user=user,
                serializer=user_serializer,
            )
        }

        for dashboard in item_dict.values():
            result[dashboard]["created_by"] = serialized_users.get(str(dashboard.created_by_id))

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        data = {
            "id": str(obj.id),
            "title": obj.title,
            "dateCreated": obj.date_added,
            "createdBy": attrs.get("created_by"),
            "widgetDisplay": attrs.get("widget_display", []),
            "widgetPreview": attrs.get("widget_preview", []),
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
