from django.urls import re_path

from sentry.smokey.endpoints.organization_incident_case_details import (
    OrganizationIncidentCaseDetailsEndpoint,
)
from sentry.smokey.endpoints.organization_incident_case_index import (
    OrganizationIncidentCaseIndexEndpoint,
)
from sentry.smokey.endpoints.organization_incident_case_template_details import (
    OrganizationIncidentCaseTemplateDetailsEndpoint,
)
from sentry.smokey.endpoints.organization_incident_case_template_index import (
    OrganizationIncidentCaseTemplateIndexEndpoint,
)
from sentry.smokey.endpoints.organization_incident_components_details import (
    OrganizationIncidentComponentDetailsEndpoint,
)
from sentry.smokey.endpoints.organization_incident_components_index import (
    OrganizationIncidentComponentIndexEndpoint,
)

smokey_organization_urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-cases/$",
        OrganizationIncidentCaseIndexEndpoint.as_view(),
        name="sentry-api-0-organization-incident-cases",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-cases/(?P<case_id>\d+)/$",
        OrganizationIncidentCaseDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-incident-case-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-case-templates/$",
        OrganizationIncidentCaseTemplateIndexEndpoint.as_view(),
        name="sentry-api-0-organization-incident-case-templates",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-case-templates/(?P<template_id>\d+)/$",
        OrganizationIncidentCaseTemplateDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-incident-case-template-details",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-components/$",
        OrganizationIncidentComponentIndexEndpoint.as_view(),
        name="sentry-api-0-organization-incident-components",
    ),
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/incident-components/(?P<component_id>\d+)/$",
        OrganizationIncidentComponentDetailsEndpoint.as_view(),
        name="sentry-api-0-organization-incident-component-details",
    ),
]
