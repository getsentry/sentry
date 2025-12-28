"""
URL configuration for SentryNew organization endpoints.

This file should be included in the main sentry/api/urls.py
"""

from django.urls import re_path

from sentry.api.endpoints.organization_claim_sentrynew import OrganizationClaimSentryNewEndpoint

urlpatterns = [
    # SentryNew organization claiming endpoint
    re_path(
        r"^(?P<organization_slug>[^\/]+)/claim-sentrynew/$",
        OrganizationClaimSentryNewEndpoint.as_view(),
        name="sentry-api-0-organization-claim-sentrynew",
    ),
]
