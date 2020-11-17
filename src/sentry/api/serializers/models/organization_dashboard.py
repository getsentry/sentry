from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Dashboard, Widget, WidgetDataSource, WidgetDisplayTypes


@register(Widget)
class WidgetSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}
        data_sources = serialize(
            list(WidgetDataSource.objects.filter(widget_id__in=[i.id for i in item_list]))
        )

        for widget in item_list:
            widget_data_sources = [
                d for d in data_sources if d["widgetId"] == six.text_type(widget.id)
            ]
            result[widget] = {"dataSources": widget_data_sources}

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": six.text_type(obj.id),
            "order": six.text_type(obj.order),
            "title": obj.title,
            "displayType": WidgetDisplayTypes.get_type_name(obj.display_type),
            "displayOptions": obj.display_options,
            "dateCreated": obj.date_added,
            "dashboardId": six.text_type(obj.dashboard_id),
            "dataSources": attrs["dataSources"],
        }


@register(WidgetDataSource)
class WidgetDataSourceSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": six.text_type(obj.id),
            "type": obj.type,
            "name": obj.name,
            "data": obj.data,
            "order": six.text_type(obj.order),
            "widgetId": six.text_type(obj.widget_id),
        }


@register(Dashboard)
class DashboardWithWidgetsSerializer(Serializer):
    def get_attrs(self, item_list, user):
        result = {}

        widgets = serialize(list(Widget.objects.filter(dashboard_id__in=[i.id for i in item_list])))

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
