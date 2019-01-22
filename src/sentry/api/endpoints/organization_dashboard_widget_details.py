from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardWidgetEndpoint, WidgetSerializer
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
        :auth: required
        """
        serializer = WidgetSerializer(data=request.DATA)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serializer.object
        # save data somewhow
        return Response(serialize(widget, request.user))
