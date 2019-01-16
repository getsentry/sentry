from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Dashboard, WidgetDataSource, WidgetDisplayTypes


class WidgetSerializer(Serializer):
    def serialize(self, obj, attrs, user, *args, **kwargs):
        return {
            'id': six.text_type(obj.id),
            'order': six.text_type(obj.order),
            'title': obj.title,
            'displayType': WidgetDisplayTypes.get_type_name(obj.display_type),
            'displayOptions': obj.display_options,
            'dateAdded': obj.date_added,
        }


class WidgetDataSourceSerializer(Serializer):
    def serialize(self, obj, attrs, user, *args, **kwargs):
        return {
            'id': six.text_type(obj.id),
            'type': obj.type,
            'name': obj.name,
            'data': obj.data,
            'order': six.text_type(obj.order),
        }


@register(Dashboard)
class DashboardWithWidgetsSerializer(Serializer):

    def get_attrs(self, item_list, user):
        widget_data_sources = WidgetDataSource.objects.filter(
            widget__dashboard_id__in=[i.id for i in item_list]
        ).select_related('widget')
        widgets = {}

        for widget_data_source in widget_data_sources:
            widget = widget_data_source.widget
            if widget not in widgets:
                widgets[widget] = serialize(widget, user, WidgetSerializer())
                widgets[widget]['dataSources'] = []
            widgets[widget]['dataSources'].append(
                serialize(
                    widget_data_source,
                    user,
                    WidgetDataSourceSerializer()))

        result = {}
        for dashboard in item_list:
            result[dashboard] = {'widgets': [widgets[w]
                                             for w in widgets if w.dashboard_id == dashboard.id]}

        return result

    def serialize(self, obj, attrs, user, *args, **kwargs):
        data = {
            'id': six.text_type(obj.id),
            'title': obj.title,
            'organization': six.text_type(obj.organization.id),
            'dateAdded': obj.date_added,
            'createdBy': six.text_type(obj.created_by.id),
            'widgets': attrs['widgets']
        }
        return data
