from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.dashboard import OrganizationDashboardEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    get_next_dashboard_order,
    ListField,
    ValidationError,
)
from sentry.models import ObjectStatus, DashboardWidget


def remove_widgets(dashboard_widgets, widget_data):
    """
    Removes current widgets belonging to dashboard not in widget_data.
    Returns remaining widgets.
    """
    widget_ids = [wd["id"] for wd in widget_data]
    dashboard_widgets.exclude(id__in=widget_ids).delete()
    return dashboard_widgets.filter(id__in=widget_ids)


def reorder_widgets(dashboard_id, widget_data):
    """
    Reorders Widgets given the relative order desired,
    reorders widgets in the next possible set of numbers
    i.e if order of widgets is 1, 2, 3
        the reordered widgets will have order 4, 5, 6
    """
    dashboard_widgets = DashboardWidget.objects.filter(dashboard_id=dashboard_id)
    dashboard_widgets = list(remove_widgets(dashboard_widgets, widget_data))

    next_order = get_next_dashboard_order(dashboard_id)
    for index, data in enumerate(widget_data):
        for widget in dashboard_widgets:
            if widget.id == data["id"]:
                widget.order = next_order + index
                widget.save()
                break


class DashboardWidgetSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=0, required=True)


class DashboardWithWidgetsSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    widgets = ListField(child=DashboardWidgetSerializer(), required=False, allow_null=True)

    def validate_widgets(self, widgets):
        widgets_count = DashboardWidget.objects.filter(
            id__in=[w["id"] for w in widgets], dashboard_id=self.context["dashboard_id"],
        ).count()

        if len(widgets) != widgets_count:
            raise ValidationError(
                "All widgets must exist within this dashboard prior to reordering."
            )

        return widgets


class OrganizationDashboardDetailsEndpoint(OrganizationDashboardEndpoint):
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
            data=request.data, context={"dashboard_id": dashboard.id}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data
        try:
            with transaction.atomic():
                title = data.get("title")
                if title:
                    dashboard.update(title=data["title"])

                widgets = data.get("widgets")
                if widgets:
                    reorder_widgets(dashboard.id, widgets)
        except IntegrityError:
            return self.respond({"Dashboard with that title already exists"}, status=409)

        return self.respond(serialize(dashboard, request.user), status=200)
