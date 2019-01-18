from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardEndpoint
)
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus
from rest_framework.response import Response

from sentry.api.bases.dashboard import DashboardWithWidgetsSerializer
from sentry.models import Widget, WidgetDataSource


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
        serializer = DashboardWithWidgetsSerializer(
            data=request.DATA,
            context={'organization': organization}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.object

        dashboard.update(
            title=data['title'],
            created_by=data['createdBy']
        )
        for widget_data in data['widgets']:
            widget, __created = Widget.objects.create_or_update(
                dashboard_id=dashboard.id,
                order=widget_data['order'],
                values={
                    'title': widget_data['title'],
                    'display_type': widget_data['displayType'],
                    'display_options': widget_data.get('displayOptions', {}),
                }
            )
            for data_source in widget_data['dataSources']:
                WidgetDataSource.objects.create_or_update(
                    widget_id=widget.id,
                    values={
                        'name': data_source['name'],
                        'data': data_source['data'],
                        'type': data_source['type'],
                    },
                    order=data_source['order'],
                )
        return self.respond(serialize(dashboard, request.user), status=200)
