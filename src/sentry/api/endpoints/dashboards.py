from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Dashboards
from rest_framework.response import Response


class DashboardsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        Retrieve an Organizations Dashboards
        `````````````````````````````````````

        Retrieve a list of dashboards that are associated with the given organization.

        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :qparam string query: the title of the dashboard being searched for.
        :auth: required
        """
        dashboards = Dashboards.objects.filter(
            organization_id=organization.id
        )
        query = request.GET.get('query')
        if query:
            dashboards = dashboards.objects.filter(
                title=query,
            )

        context = serialize(dashboards, request.user)
        return Response(context)
