from __future__ import absolute_import

from django.db import IntegrityError, transaction
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.dashboard import (
    OrganizationDashboardEndpoint, WidgetSerializer, get_next_dashboard_order
)
from sentry.api.serializers import serialize
from sentry.models import Widget


class OrganizationDashboardWidgetsEndpoint(OrganizationDashboardEndpoint):

    doc_section = DocSection.ORGANIZATIONS

    def post(self, request, organization, dashboard):
        """
        Create a New Widget for an Organization's Dashboard
        ```````````````````````````````````````````````````
        Create a new dashboard for the given Organization
        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.

        """
        serializer = WidgetSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        try:
            with transaction.atomic():
                widget = Widget.objects.create(
                    organization_id=organization.id,
                    display_type=result['display_type'],
                    display_options=result['display_options'],
                    title=result['title'],
                    order=get_next_dashboard_order(dashboard.id),
                    dashboard_id=dashboard.id,
                )
        except IntegrityError:
            return Response('This widget already exists', status=409)

        return Response(serialize(widget, request.user), status=201)
