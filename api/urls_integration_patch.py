"""
Integration patch for adding Hackweek endpoints to Sentry API URLs.

Apply this to your main sentry/api/urls.py file.
"""

# ==============================================================================
# OPTION 1: Add as individual import
# ==============================================================================
# Add this import at the top of sentry/api/urls.py (around line 10-20):
from sentry.api.endpoints.organization_claim_hackweek import OrganizationClaimHackweekEndpoint

# Then add this to the urlpatterns list (around line 500-600, near other organization endpoints):
urlpatterns = [
    # ... existing patterns ...
    # Hackweek organization claiming
    re_path(
        r"^(?P<organization_slug>[^\/]+)/claim-hackweek/$",
        OrganizationClaimHackweekEndpoint.as_view(),
        name="sentry-api-0-organization-claim-hackweek",
    ),
    # ... more patterns ...
]

# ==============================================================================
# OPTION 2: Add as a separate included module (cleaner)
# ==============================================================================
# At the top of sentry/api/urls.py:
from django.urls import include

# Then in urlpatterns, add:
urlpatterns = [
    # ... existing patterns ...
    # Hackweek endpoints
    path("", include("sentry.api.urls_hackweek")),
    # ... more patterns ...
]

# ==============================================================================
# OPTION 3: Add to organization-specific URL patterns
# ==============================================================================
# Find where organization endpoints are defined (search for "organization_slug")
# Add this pattern near other organization-specific endpoints:

from sentry.api.endpoints.organization_claim_hackweek import OrganizationClaimHackweekEndpoint

# In the organization patterns section:
organization_urls = [
    # ... existing organization endpoints ...
    url(
        regex=r"^(?P<organization_slug>[^\/]+)/claim-hackweek/$",
        view=OrganizationClaimHackweekEndpoint.as_view(),
        name="sentry-api-0-organization-claim-hackweek",
    ),
    # ... more organization endpoints ...
]
