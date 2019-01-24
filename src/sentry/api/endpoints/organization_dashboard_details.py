from __future__ import absolute_import

from django.db.models import Max
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardEndpoint
)
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField, ValidationError
from sentry.models import ObjectStatus, Widget


def get_next_dashboard_order(dashboard_id):
    max_order = Widget.objects.filter(
        dashboard_id=dashboard_id,
    ).aggregate(Max('order'))
    return max_order['order__max'] + 1


def remove_widgets(dashboard_widgets, widget_data):
    """
    Removes current widgets belonging to dashboard not in widget_data.
    Returns remaining widgets.
    """
    widget_titles = [wd['id'] for wd in widget_data]
    dashboard_widgets.exclude(
        id__in=widget_titles
    ).update(status=ObjectStatus.PENDING_DELETION)

    return dashboard_widgets.filter(
        id__in=widget_titles
    )


def reorder_widgets(dashboard_id, widget_data):
    """
    Reorders Widgets given the relative order desired,
    reorders widgets in the next possible set of numbers
    i.e if order of widgets is 1, 2, 3
        the reordered widgets will have order 4, 5, 6
    """
    dashboard_widgets = Widget.objects.filter(
        dashboard_id=dashboard_id,
    )
    dashboard_widgets = list(remove_widgets(dashboard_widgets, widget_data))

    # dashboard_widgets and widget_data should now have the same widgets
    widget_data.sort(key=lambda x: x['order'])

    next_order = get_next_dashboard_order(dashboard_id)
    for index, data in enumerate(widget_data):
        for widget in dashboard_widgets:
            if widget.id == data['id']:
                widget.order = next_order + index
                widget.save()
                break


class WidgetSerializer(serializers.Serializer):
    order = serializers.IntegerField(min_value=0, required=True)
    id = serializers.IntegerField(min_value=0, required=True)


class DashboardWithWidgetsSerializer(serializers.Serializer):
    title = serializers.CharField(required=False)
    widgets = ListField(
        child=WidgetSerializer(),
        required=False,
        allow_null=True,
    )

    def validate_widgets(self, attrs, source):
        try:
            widgets = attrs[source]
        except KeyError:
            return attrs

        if len(widgets) != len(set([w['order'] for w in widgets])):
            raise ValidationError('Widgets must have no repeating order')

        widgets_count = len(Widget.objects.filter(
            id__in=[w['id'] for w in widgets],
            dashboard_id=self.context['dashboard_id'],
            status=ObjectStatus.VISIBLE,
        ))

        if len(widgets) != widgets_count:
            raise ValidationError(
                'All widgets must exist within this dashboard prior to reordering.')

        return attrs


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
        :auth: required
        """

        dashboard.status = ObjectStatus.PENDING_DELETION
        dashboard.save()

        return self.respond(status=204)

    def put(self, request, organization, dashboard):
        """
        Edit an Organization's Dashboard
        ```````````````````````````````````

        Edit an individual organization's dashboard as well as
        bulk edits on widgets (i.e. rearranging widget order).

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :param array widgets: the array of widgets (consisting of a widget id and the order)
                            to be updated.
        :auth: required
        """
        serializer = DashboardWithWidgetsSerializer(
            data=request.DATA,
            context={'dashboard_id': dashboard.id}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.object

        title = data.get('title')
        if title:
            dashboard.update(title=data['title'])

        widgets = data.get('widgets')
        if widgets:
            reorder_widgets(dashboard.id, widgets)

        return self.respond(serialize(dashboard, request.user), status=200)
