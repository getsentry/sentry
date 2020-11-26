from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework import serializers

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import DashboardDetailsSerializer
from sentry.models import Dashboard
from rest_framework.response import Response


class DashboardSerializer(serializers.Serializer):
    title = serializers.CharField(required=True)


class OrganizationDashboardsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve an Organization's Dashboards
        `````````````````````````````````````
        Retrieve a list of dashboards that are associated with the given organization.
        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :qparam string query: the title of the dashboard being searched for.
        :auth: required
        """
        dashboards = Dashboard.objects.filter(organization_id=organization.id)
        query = request.GET.get("query")
        if query:
            dashboards = dashboards.filter(title__icontains=query)

        return self.paginate(
            request=request,
            queryset=dashboards,
            order_by="title",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
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
        serializer = DashboardDetailsSerializer(
            data=request.data, context={"organization_id": organization.id, "request": request}
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            with transaction.atomic():
                dashboard = serializer.save()
                return Response(serialize(dashboard, request.user), status=201)
        except IntegrityError:
            return Response("Dashboard title already taken", status=409)
