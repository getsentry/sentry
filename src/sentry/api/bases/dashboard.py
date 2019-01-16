from __future__ import absolute_import
from rest_framework import serializers
from sentry.models import WidgetDisplayTypes, WidgetDataSourceTypes

from sentry.api.serializers.rest_framework.json import JSONField
from sentry.api.serializers.rest_framework.list import ListField
from sentry.api.fields.user import UserField
from sentry.api.bases.discoversavedquery import DiscoverSavedQuerySerializer


class WidgetDataSourceSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    data = JSONField(required=True)
    type = serializers.CharField(required=True)
    order = serializers.IntegerField(required=True)

    def validate_type(self, attrs, source):
        type = attrs[source]
        if type not in WidgetDataSourceTypes.TYPE_NAMES:
            raise ValueError('Widget data source type %s not recognized.' % type)
        attrs[source] = WidgetDataSourceTypes.get_name_type(type)
        return attrs

    def validate(self, data):
        if data['type'] == WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH:
            serializer = DiscoverSavedQuerySerializer(data=data['data'], context=self.context)
            if not serializer.is_valid():
                raise ValueError('Error validating DiscoverSavedQuery: %s' % serializer.errors)
        return data


class WidgetSerializer(serializers.Serializer):
    order = serializers.IntegerField(min_value=0, required=True)
    displayType = serializers.CharField(required=True)
    displayOptions = JSONField(required=False)
    title = serializers.CharField(required=True)
    dataSources = ListField(
        child=WidgetDataSourceSerializer(),
        required=True,
        default=[],
    )

    def validate_displayType(self, attrs, source):
        display_type = attrs[source]
        if display_type not in WidgetDisplayTypes.TYPE_NAMES:
            raise ValueError('Widget display_type %s not recognized.' % display_type)

        attrs[source] = WidgetDisplayTypes.get_name_type(display_type)
        return attrs


class DashboardSerializer(serializers.Serializer):
    title = serializers.CharField(required=True)
    createdBy = UserField(required=True)


class DashboardWithWidgetsSerializer(DashboardSerializer):
    widgets = ListField(
        child=WidgetSerializer(),
        required=False,
        default=[],
    )
