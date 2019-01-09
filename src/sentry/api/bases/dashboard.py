from __future__ import absolute_import

from sentry.api.bases.organization import (
    OrganizationEndpoint
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Dashboard


class OrganizationDashboardEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardEndpoint,
                             self).convert_args(request, organization_slug)

        try:
            kwargs['dashboard'] = self._get_dashboard(request, kwargs['organization'], dashboard_id)
        except Dashboard.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_dashboard(self, request, organization, dashboard_id):
        return Dashboard.objects.get(
            id=dashboard_id,
            organization_id=organization.id
        )


from rest_framework import serializers
from sentry.api.serializers.rest_framework.json import JSONField
from sentry.api.fields.user import UserField


class DashboardSerializer(serializers.Serializer):
    title = serializers.CharField(required=True)
    owner = UserField(required=True)
    data = JSONField(
        required=False,
    )
