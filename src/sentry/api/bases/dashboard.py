from __future__ import absolute_import
from rest_framework import serializers
from sentry.models import Dashboard, Widget, WidgetDisplayTypes, WidgetDataSourceTypes

from sentry.api.serializers.rest_framework.json import JSONField
from sentry.api.serializers.rest_framework.list import ListField
from sentry.api.fields.user import UserField
from sentry.api.bases.discoversavedquery import DiscoverSavedQuerySerializer


class WidgetDataSource(serializers.WritableField):
    name = serializers.CharField(required=False)
    data = JSONField(required=True)
    type = serializers.CharField(required=True)

    def validate_type(self, attrs, source):
        type = attrs[source]
        if type not in WidgetDataSourceTypes.__members__:
            raise ValueError('Widget data source type %s not recognized.' % type)
        return attrs

    def validate(self, data):
        if data['type'] == WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH:
            serializer = DiscoverSavedQuerySerializer(data=data['data'])
            if not serializer.is_valid():
                raise ValueError('Error validating DiscoverSavedQuery: %s' % serializer.errors)
        return data


class WidgetSerializer(serializers.WritableField):
    order = serializers.IntegerField(min_value=0, required=True)
    display_type = serializers.CharField(required=True)
    data = JSONField(
        required=True,
    )
    data_sources = ListField(
        child=WidgetDataSource(),
        required=True,
        default=[],
    )
    data = JSONField(
        required=False,
    )

    def validate_display_type(self, attrs, source):
        display_type = attrs[source]
        if display_type not in WidgetDisplayTypes.__members__:
            raise ValueError('Widget display_type %s not recognized.' % display_type)
        return attrs


class DashboardSerializer(serializers.Serializer):
    title = serializers.CharField(required=True)
    owner = UserField(required=True)
    data = JSONField(
        required=False,
    )
    widgets = ListField(
        child=WidgetSerializer(),
        required=False,
        default=[],
    )

    def save(self):
        dashboard_id = self.context.get('dashboard_id')
        organization_id = self.context['organization'].id
        if dashboard_id:
            dashboard = Dashboard.objects.update(
                id=dashboard_id,
                organization_id=organization_id,
                values={
                    'title': self.data['title'],
                    'owner': self.data['owner'],
                    'data': self.data['data'],
                }
            )
        else:
            dashboard = Dashboard.objects.create(
                organization_id=organization_id,
                title=self.data['title'],
                owner=self.data['owner'],
                data=self.data['data'],
            )

        for widget_data in self.data['widgets']:
            widget = Widget.objects.create_or_update(
                dashboad_id=dashboard.id,
                order=widget_data['order'],
                display_type=widget_data['display_type'],
                title=widget_data['title'],
            )
            for data_source in widget_data['data_sources']:
                WidgetDataSource.objects.create_or_update(
                    widget_id=widget.id,
                    data=data_source['data'],
                    name=data_source['name'],
                    type=data_source['type'],
                )
