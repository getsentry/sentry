from __future__ import absolute_import

from django.db.models import Max
from rest_framework import serializers

from sentry.api.bases.organization import (
    OrganizationEndpoint
)
from sentry.api.serializers.rest_framework import JSONField, ListField, ValidationError
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Dashboard, Widget, WidgetDisplayTypes, WidgetDataSourceTypes

from sentry.api.bases.discoversavedquery import DiscoverSavedQuerySerializer


def get_next_dashboard_order(dashboard_id):
    max_order = Widget.objects.filter(
        dashboard_id=dashboard_id,
    ).aggregate(Max('order'))['order__max']

    return max_order + 1 if max_order else 1


class OrganizationDashboardEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardEndpoint,
                             self).convert_args(request, organization_slug)

        try:
            kwargs['dashboard'] = self._get_dashboard(request, kwargs['organization'], dashboard_id)
        except Dashboard.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_dashboard(self, request, organization, dashboard_id):
        return Dashboard.objects.get(
            id=dashboard_id,
            organization_id=organization.id
        )


class OrganizationDashboardWidgetEndpoint(OrganizationDashboardEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, widget_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardWidgetEndpoint,
                             self).convert_args(request, organization_slug)

        try:
            kwargs['widget'] = self._get_widget(
                request, kwargs['organization'], dashboard_id, widget_id)
        except Widget.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_widget(self, request, organization, dashboard_id, widget_id):
        return Widget.objects.get(
            id=widget_id,
            organization_id=organization.id,
            dashboard_id=dashboard_id,
        )


class WidgetDataSourceSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    data = JSONField(required=True)
    type = serializers.CharField(required=True)
    order = serializers.IntegerField(required=True)

    def validate_type(self, attrs, source):
        type = attrs[source]
        if type not in WidgetDataSourceTypes.TYPE_NAMES:
            raise ValidationError('Widget data source type %s not recognized.' % type)
        attrs[source] = WidgetDataSourceTypes.get_id_for_type_name(type)
        return attrs

    def validate(self, data):
        if data['type'] == WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH:
            serializer = DiscoverSavedQuerySerializer(data=data['data'], context=self.context)
            if not serializer.is_valid():
                raise ValidationError('Error validating DiscoverSavedQuery: %s' % serializer.errors)
        return data


class WidgetSerializer(serializers.Serializer):
    displayType = serializers.CharField(required=True)
    displayOptions = JSONField(required=False)
    title = serializers.CharField(required=True)
    dataSources = ListField(
        child=WidgetDataSourceSerializer(required=False),
        required=False,
        allow_null=True,
    )

    def validate_displayType(self, attrs, source):
        display_type = attrs[source]
        if display_type not in WidgetDisplayTypes.TYPE_NAMES:
            raise ValidationError('Widget display_type %s not recognized.' % display_type)

        attrs[source] = WidgetDisplayTypes.get_id_for_type_name(display_type)
        return attrs
