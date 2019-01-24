from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardWidgetEndpoint, WidgetDataSource, WidgetSerializer
)
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus


class OrganizationDashboardWidgetDetailsEndpoint(OrganizationDashboardWidgetEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization, widget):
        """
        Retrieve an Organization's Dashboard's Widget
        `````````````````````````````````````````````

        Return details on an individual organization's dashboard's widget.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget belonging to a dashboard
                                the organization owns.
        :auth: required
        """

        return self.respond(serialize(widget, request.user))

    def delete(self, request, organization, widget):
        """
        Delete an Organization's Dashboard
        ```````````````````````````````````

        Delete an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget belonging to a dashboard
                                the organization owns.
        :auth: required
        """

        widget.status = ObjectStatus.PENDING_DELETION
        widget.save()

        return self.respond(status=204)

    def put(self, request, organization, widget):
        """
        Edit an Organization's Dashboard
        ```````````````````````````````````

        Edit an individual organization's dashboard.

        :pparam string organization_slug: the slug of the organization the
                                          dashboard belongs to.
        :pparam int dashboard_id: the id of the dashboard.
        :pparam int widget_id: the id of the widget belonging to a dashboard
                                the organization owns.
        :param string title: the title of the widget.
        :param string display_type: the widget display type (i.e. line or table).
        :param array display_options: the widget display options are special
                                    variables necessary to displaying the widget correctly.
        :auth: required
        """
        # TODO(lb): the display type has a set number of things you can enter.
        # Where is the right place to document this? I vote linking to
        # another page in the docs that shows what each type is with photos.

        serializer = WidgetSerializer(data=request.DATA)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.object
        # TODO(lb): For now, I am deciding to not allow moving widgets from dashboard to dashboard.
        widget.update(
            title=data.get('title', widget.title),
            display_type=data.get('display_type', widget.display_type),
            display_options=data.get('display_options', widget.display_options)
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
            )

        return Response(serialize(widget, request.user))
