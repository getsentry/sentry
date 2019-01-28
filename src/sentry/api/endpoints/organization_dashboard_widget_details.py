from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardWidgetEndpoint, WidgetSerializer
)
from sentry.api.serializers import serialize
from sentry.models import WidgetDataSource


class OrganizationDashboardWidgetDetailsEndpoint(OrganizationDashboardWidgetEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def delete(self, request, organization, dashboard, widget):
        """
        Delete an Organization's Dashboard
        ```````````````````````````````````

        Delete an individual widget on an organization's dashboard.

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
        Edit an Organization's Dashboard
        ```````````````````````````````````

        Edit an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget.
        :param string title: the title of the widget.
        :param string displayType: the widget display type (i.e. line or table).
        :param array displayOptions: the widget display options are special
                                    variables necessary to displaying the widget correctly.
        :param array dataSources: the sources of data for the widget to display.
        :auth: required
        """
        # TODO(lb): the display type has a set number of things you can enter.
        # Where is the right place to document this? I think linking to
        # another page in the docs that shows what each type is with photos is best.

        serializer = WidgetSerializer(data=request.DATA, context={'organization': organization})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.object
        # TODO(lb): For now, I am deciding to not allow moving widgets from dashboard to dashboard.
        widget.update(
            title=data.get('title', widget.title),
            display_type=data.get('displayType', widget.display_type),
            display_options=data.get('displayOptions', widget.display_options)
        )

        data_sources = data.get('dataSources', [])
        if data_sources:
            WidgetDataSource.objects.filter(
                widget_id=widget.id
            ).delete()
        for widget_data in data_sources:
            WidgetDataSource.objects.create(
                name=widget_data['name'],
                data=widget_data['data'],
                type=widget_data['type'],
                order=widget_data['order'],
                widget_id=widget.id,
            )

        return Response(serialize(widget, request.user))
