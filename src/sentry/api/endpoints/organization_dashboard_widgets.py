from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import OrganizationDashboardEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import get_next_dashboard_order, WidgetSerializer
from sentry.models import Widget, WidgetDataSource


class OrganizationDashboardWidgetsEndpoint(OrganizationDashboardEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def post(self, request, organization, dashboard):
        """
        Create a New Widget for an Organization's Dashboard
        ```````````````````````````````````````````````````
        Create a new widget on the dashboard for the given Organization
        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :param string title: the title of the widget.
        :param string displayType: the widget display type (i.e. line or table).
        :param array displayOptions: the widget display options are special
                                    variables necessary to displaying the widget correctly.
        :param array dataSources: the sources of data for the widget to display.
        :auth: required
        """

        serializer = WidgetSerializer(data=request.data, context={"organization": organization})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        try:
            with transaction.atomic():
                widget = Widget.objects.create(
                    display_type=result["displayType"],
                    display_options=result.get("displayOptions", {}),
                    title=result["title"],
                    order=get_next_dashboard_order(dashboard.id),
                    dashboard_id=dashboard.id,
                )
                for widget_data in result.get("dataSources", []):
                    WidgetDataSource.objects.create(
                        name=widget_data["name"],
                        data=widget_data["data"],
                        type=widget_data["type"],
                        order=widget_data["order"],
                        widget_id=widget.id,
                    )
        except IntegrityError:
            return Response("This widget already exists", status=409)

        return Response(serialize(widget, request.user), status=201)
