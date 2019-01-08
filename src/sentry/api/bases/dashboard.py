from __future__ import absolute_import
from rest_framework import serializers
from sentry.models import WidgetDisplayTypes, WidgetDataSourceTypes
from sentry.api.serializers.rest_framework.json import JSONField, ListField
from sentry.api.bases.discoversavedquery import DicsoverSavedQuerySerializer


class WidgetDataSource(serializers.Serializer):
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
            serializer = DicsoverSavedQuerySerializer(data=data['data'])
            if not serializer.is_valid():
                raise ValueError('Error validating DiscoverSavedQuery: %s' % serializer.errors)
        return data


class WidgetSerializer(serializers.Serializer):
    dashboard_order = serializers.IntegerField(min_value=0, required=True)
    display_type = serializers.CharField(required=True)
    data = JSONField(
        required=True,
    )
    data_sources = ListField(
        child=WidgetDataSource,
        required=True,
        default=[],
    )

    def validate_display_type(self, attrs, source):
        display_type = attrs[source]
        if display_type not in WidgetDisplayTypes.__members__:
            raise ValueError('Widget display_type %s not recognized.' % display_type)
        return attrs
