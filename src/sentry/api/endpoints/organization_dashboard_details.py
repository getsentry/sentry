from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardEndpoint, DashboardSerializer
)
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.models import ObjectStatus, Widget


def remove_widgets(dashboard_widgets, widget_data):
    """
    Removes current widgets belonging to dashboard not in widget_data.
    Returns remaining widgets.
    """
    widget_titles = [wd['id'] for wd in widget_data]
    dashboard_widgets.exclude(
        id__in=widget_titles
    ).delete()
    return dashboard_widgets.filter(
        id__in=widget_titles
    )


def reorder_widgets(dashboard_id, widget_data):
    """

    """
    dashboard_widgets = Widget.objects.filter(
        dashboard_id=dashboard_id,
    )
    dashboard_widgets = remove_widgets(dashboard_widgets, widget_data)

    for widget_datum in widget_data:
        for widget in dashboard_widgets:
            if widget.id == widget_datum['id']:
                widget.order = widget_datum['order']
                widget.save()


class WidgetSerializer(serializers.Serializer):
    order = serializers.IntegerField(min_value=0, required=True)
    id = serializers.IntegerField(min_value=0, required=True)


class DashboardWithWidgetsSerializer(DashboardSerializer):
    widgets = ListField(
        child=WidgetSerializer(),
        required=False,
        default=[],
    )

    def validate(self, data):
        widgets = data['widgets']

        if len(widgets) != len(set([w['order'] for w in widgets])):
            raise ValueError('Widgets must have no repeating order')

        widgets_count = len(Widget.objects.filter(
            id__in=[w['id'] for w in data['widgets']],
            dashboard_id=self.context['dashboard_id'],
            status=ObjectStatus.VISIBLE,
        ))

        if len(widgets) != widgets_count:
            raise ValueError('All widgets must exist within this dashboard prior to reordering.')

        return data


class OrganizationDashboardDetailsEndpoint(OrganizationDashboardEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization, dashboard):
        """
        Retrieve an Organization's Dashboard
        ````````````````````````````````````

        Return details on an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :auth: required
        """

        return self.respond(serialize(dashboard, request.user))

    def delete(self, request, organization, dashboard):
        """
        Delete an Organization's Dashboard
        ```````````````````````````````````

        Delete an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :param array widgets: the array of widgets (consisting of a widget id and the order)
                            to be updated.
        :auth: required
        """

        dashboard.status = ObjectStatus.PENDING_DELETION
        dashboard.save()

        return self.respond(status=204)

    def put(self, request, organization, dashboard):
        serializer = DashboardWithWidgetsSerializer(
            data=request.DATA,
            context={'dashboard_id': dashboard.id}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.object

        dashboard.update(
            title=data['title'],
        )
        reorder_widgets(dashboard.id, data['widgets'])
        return self.respond(serialize(dashboard, request.user), status=200)
