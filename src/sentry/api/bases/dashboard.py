from __future__ import absolute_import

from django.db.models import Max

from sentry.api.bases.organization import (
    OrganizationEndpoint
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Dashboard, Widget


def get_next_dashboard_order(dashboard_id):
    max_order = Widget.objects.filter(
        dashboard_id=dashboard_id,
    ).aggregate(Max('order'))['order__max']

    return max_order + 1 if max_order else 1


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


class OrganizationDashboardWidgetEndpoint(OrganizationDashboardEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, widget_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardWidgetEndpoint,
                             self).convert_args(request, organization_slug, dashboard_id, widget_id, *args, **kwargs)

        try:
            kwargs['widget'] = self._get_widget(
                request, kwargs['organization'], dashboard_id, widget_id)
        except Widget.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_widget(self, request, organization, dashboard_id, widget_id):
        return Widget.objects.get(
            id=widget_id,
            dashboard_id=dashboard_id,
        )
