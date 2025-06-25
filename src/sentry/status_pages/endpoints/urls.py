from django.urls import re_path

from sentry.status_pages.endpoints.organization_status_pages import OrganizationStatusPagesEndpoint

# Define your URL patterns here
organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/status-pages/$",
        OrganizationStatusPagesEndpoint.as_view(),
        name="sentry-api-0-organization-status-pages",
    ),
]

# Add any whitelist URLs if needed
# add_logout_whitelist(...)
