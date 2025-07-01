from django.urls import re_path

from sentry.status_pages.endpoints.organization_status_page_details import (
    OrganizationStatusPageDetailsEndpoint,
)
from sentry.status_pages.endpoints.organization_status_page_index import (
    OrganizationStatusPagesEndpoint,
)
from sentry.status_pages.endpoints.organization_status_update_index import (
    OrganizationStatusUpdateIndexEndpoint,
)

# Define your URL patterns here
organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/status-pages/$",
        OrganizationStatusPagesEndpoint.as_view(),
        name="sentry-api-0-organization-status-pages",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/status-pages/(?P<status_page_id>[^/]+)/$",
        OrganizationStatusPageDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-status-page-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/status-pages/(?P<status_page_id>[^/]+)/status-updates/$",
        OrganizationStatusUpdateIndexEndpoint.as_view(),
        name="sentry-api-0-organization-status-page-status-updates",
    ),
]

# Add any whitelist URLs if needed
# add_logout_whitelist(...)
