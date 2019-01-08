from __future__ import absolute_import


from django.db import IntegrityError, transaction
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases.dashboard import DashboardSerializer
from sentry.api.serializers import serialize
from sentry.models import Dashboard
from rest_framework.response import Response


class OrganizationDashboardsEndpoint(OrganizationEndpoint):
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
        dashboards = Dashboard.objects.filter(
            organization_id=organization.id
        )
        query = request.GET.get('query')
        if query:
            dashboards = dashboards.objects.filter(
                title=query,
            )

        context = serialize(dashboards, request.user)
        return Response(context)

    def post(self, request, organization):
        serializer = DashboardSerializer(data=request.DATA, context={'organization': organization})

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        try:
            with transaction.atomic():
                dashboard = Dashboard.objects.create(
                    organization_id=organization.id,
                    title=result['title'],
                    owner=result.get('owner') or request.user,
                    data=result.get('data'),
                    date_added=result.get('dateAdded'),
                )
        except IntegrityError:
            # dashboard, created = Dashboard.objects.get(
            #     organization_id=organization.id,
            #     version=result['title'],
            # ), False
            pass  # hmm what to do here?

        return Response(serialize(dashboard, request.user), status=201)
