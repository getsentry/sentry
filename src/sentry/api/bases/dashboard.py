from __future__ import absolute_import
from rest_framework import serializers
from sentry.models import Dashboard, Widget, WidgetDisplayTypes, WidgetDataSource, WidgetDataSourceTypes

from sentry.api.serializers.rest_framework.json import JSONField
from sentry.api.serializers.rest_framework.list import ListField
from sentry.api.fields.user import UserField
from sentry.api.bases.discoversavedquery import DiscoverSavedQuerySerializer


class WidgetDataSourceSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False)
    data = JSONField(required=True)
    type = serializers.CharField(required=True)

    class Meta:
        model = WidgetDataSource
        fields = ('name', 'data', 'type')

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


class WidgetSerializer(serializers.ModelSerializer):
    order = serializers.IntegerField(min_value=0, required=True)
    display_type = serializers.CharField(required=True)
    display_options = JSONField(required=False)

    class Meta:
        model = Widget
        fields = ('order', 'display_type', 'display_options')

    def validate_display_type(self, attrs, source):
        display_type = attrs[source]
        if display_type not in WidgetDisplayTypes.__members__:
            raise ValueError('Widget display_type %s not recognized.' % display_type)
        return attrs


class WidgetSerializerWithDataSourcesSerializer(WidgetSerializer):
    data_sources = ListField(
        child=WidgetDataSource(),
        required=True,
        default=[],
    )

    def save(self):
        super(WidgetSerializerWithDataSourcesSerializer, self).save()
        serializer = WidgetDataSourceSerializer(data=self.data)
        serializer.save()


class DashboardSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=True)
    owner = UserField(required=True)
    data = JSONField(required=False)

    class Meta:
        model = Dashboard
        fields = ('title', 'owner', 'data')


class DashboardWithWidgetsSerializer(DashboardSerializer):
    widgets = ListField(
        child=WidgetSerializer(),
        required=False,
        default=[],
    )

    def save(self):
        super(DashboardWithWidgetsSerializer, self).save()
        serializer = WidgetSerializer(data=self.data)
        serializer.save()
