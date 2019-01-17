from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardEndpoint
)
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus


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
