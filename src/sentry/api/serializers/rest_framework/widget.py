from __future__ import absolute_import

from django.db.models import Max
from rest_framework import serializers

from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.api.serializers.rest_framework import JSONField, ListField, ValidationError
from sentry.models import Widget, WidgetDisplayTypes, WidgetDataSourceTypes


def get_next_dashboard_order(dashboard_id):
    max_order = Widget.objects.filter(dashboard_id=dashboard_id).aggregate(Max("order"))[
        "order__max"
    ]

    return max_order + 1 if max_order else 1


class WidgetDataSourceSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    data = JSONField(required=True)
    type = serializers.CharField(required=True)
    order = serializers.IntegerField(required=True)

    def validate_type(self, type):
        if type not in WidgetDataSourceTypes.TYPE_NAMES:
            raise ValidationError("Widget data source type %s not recognized." % type)
        type = WidgetDataSourceTypes.get_id_for_type_name(type)
        return type

    def validate(self, data):
        super(WidgetDataSourceSerializer, self).validate(data)
        if data["type"] == WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH:
            serializer = DiscoverSavedQuerySerializer(data=data["data"], context=self.context)
            if not serializer.is_valid():
                raise ValidationError("Error validating DiscoverSavedQuery: %s" % serializer.errors)
        else:
            raise ValidationError("Widget data source type %s not recognized." % data["type"])
        return data


class WidgetSerializer(serializers.Serializer):
    displayType = serializers.CharField(required=True)
    displayOptions = JSONField(required=False)
    title = serializers.CharField(required=True)
    dataSources = ListField(
        child=WidgetDataSourceSerializer(required=False), required=False, allow_null=True
    )

    def validate_displayType(self, display_type):
        if display_type not in WidgetDisplayTypes.TYPE_NAMES:
            raise ValidationError("Widget displayType %s not recognized." % display_type)

        return WidgetDisplayTypes.get_id_for_type_name(display_type)
