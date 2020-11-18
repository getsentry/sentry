from __future__ import absolute_import

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Dashboard, DashboardWidget


class OrganizationDashboardEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardEndpoint, self).convert_args(
            request, organization_slug
        )

        try:
            kwargs["dashboard"] = self._get_dashboard(request, kwargs["organization"], dashboard_id)
        except Dashboard.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_dashboard(self, request, organization, dashboard_id):
        return Dashboard.objects.get(id=dashboard_id, organization_id=organization.id)


class OrganizationDashboardWidgetEndpoint(OrganizationDashboardEndpoint):
    def convert_args(self, request, organization_slug, dashboard_id, widget_id, *args, **kwargs):
        args, kwargs = super(OrganizationDashboardWidgetEndpoint, self).convert_args(
            request, organization_slug, dashboard_id, widget_id, *args, **kwargs
        )

        try:
            kwargs["widget"] = self._get_widget(
                request, kwargs["organization"], dashboard_id, widget_id
            )
        except DashboardWidget.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def _get_widget(self, request, organization, dashboard_id, widget_id):
        return DashboardWidget.objects.get(id=widget_id, dashboard_id=dashboard_id)
