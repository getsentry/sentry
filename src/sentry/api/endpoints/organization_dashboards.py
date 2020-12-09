from __future__ import absolute_import

from django.db import IntegrityError, transaction

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import DashboardListSerializer
from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.models import Dashboard
from rest_framework.response import Response


class OrganizationDashboardsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve an Organization's Dashboards
        `````````````````````````````````````

        Retrieve a list of dashboards that are associated with the given organization.
        If on the first page, this endpoint will also include any pre-built dashboards
        that haven't been replaced or removed.

        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :qparam string query: the title of the dashboard being searched for.
        :auth: required
        """
        dashboards = Dashboard.objects.filter(organization_id=organization.id)
        query = request.GET.get("query")
        if query:
            dashboards = dashboards.filter(title__icontains=query)
        dashboards = dashboards.order_by("title")
        prebuilt = Dashboard.get_prebuilt_list(organization, query)

        list_serializer = DashboardListSerializer()

        def handle_results(results):
            serialized = []
            for item in results:
                if isinstance(item, dict):
                    serialized.append(item)
                else:
                    serialized.append(serialize(item, request.user, serializer=list_serializer))
            return serialized

        return self.paginate(
            request=request,
            sources=[prebuilt, dashboards],
            paginator_cls=ChainPaginator,
            on_results=handle_results,
        )

    def post(self, request, organization):
        """
        Create a New Dashboard for an Organization
        ``````````````````````````````````````````
        Create a new dashboard for the given Organization
        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :param string title: the title of the dashboard.
        """
        serializer = DashboardSerializer(
            data=request.data, context={"organization": organization, "request": request}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            with transaction.atomic():
                dashboard = serializer.save()
                return Response(serialize(dashboard, request.user), status=201)
        except IntegrityError:
            return Response("Dashboard title already taken", status=409)
