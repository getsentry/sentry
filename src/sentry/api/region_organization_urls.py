from django.conf.urls import url

from sentry.api.base import create_region_endpoint_class

from .endpoints.organization_events import OrganizationEventsEndpoint

urlpatterns = [  # Organizations
    # Organizations
    url(
        r"^events/$",
        create_region_endpoint_class(OrganizationEventsEndpoint).as_view(),
        name="sentry-api-0-region-organization-events",
    )
]
