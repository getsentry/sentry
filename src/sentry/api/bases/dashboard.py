from __future__ import absolute_import
from rest_framework import serializers
from sentry.models import WidgetDisplayTypes
from sentry.api.serializers.rest_framework.json import JSONField, ListField


class WidgetDataSource(serializers.Serializer):
    pass


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
