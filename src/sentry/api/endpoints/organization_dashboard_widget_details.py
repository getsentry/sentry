from __future__ import absolute_import

from django.db import transaction
from rest_framework.response import Response

from sentry.api.bases.dashboard import OrganizationDashboardWidgetEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DashboardWidgetSerializer
from sentry.models import DashboardWidgetQuery


class OrganizationDashboardWidgetDetailsEndpoint(OrganizationDashboardWidgetEndpoint):
    def delete(self, request, organization, dashboard, widget):
        """
        Delete a Widget on an Organization's Dashboard
        ``````````````````````````````````````````````

        Delete a widget on an organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget.
        :auth: required
        """

        widget.delete()
        return self.respond(status=204)

    def put(self, request, organization, dashboard, widget):
        """
        Edit a Widget on an Organization's Dashboard
        ````````````````````````````````````````````

        Edit a widget on an organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget.
        :param string title: the title of the widget.
        :param string displayType: the widget display type (i.e. line or table).
        :param array displayOptions: the widget display options are special
                                    variables necessary to displaying the widget correctly.
        :param array dataSources: the sources of data for the widget to display.
                                If supplied the entire set of data sources will be deleted
                                and replaced with the input provided.
        :auth: required
        """
        serializer = DashboardWidgetSerializer(
            data=request.data, context={"organization": organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        with transaction.atomic():
            widget.update(
                title=data.get("title", widget.title),
                display_type=data.get("displayType", widget.display_type),
            )

            if "queries" in data:
                DashboardWidgetQuery.objects.filter(widget_id=widget.id).delete()
            for i, query in enumerate(data.get("queries", [])):
                DashboardWidgetQuery.objects.create(
                    name=query["name"],
                    fields=query["fields"],
                    conditions=query["conditions"],
                    interval=query["interval"],
                    order=i,
                    widget_id=widget.id,
                )

        return Response(serialize(widget, request.user))
