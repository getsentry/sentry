from datetime import timedelta

from django.http import Http404
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import experiments
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.models import Organization, Project, ProjectStatus
from sentry.snuba import discover

# Snuba names to the API layer that matches the TS definition
NAME_MAPPING = {
    "p75_measurements_fcp": "FCP",
    "p75_measurements_lcp": "LCP",
    "measurements.app_start_warm": "appStartWarm",
    "measurements.app_start_cold": "appStartCold",
}


class OrganizationVitalsOverviewEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization: Organization) -> Response:
        # only can access endpint with experiment
        if not experiments.get("VitalsAlertExperiment", organization, request.user):
            raise Http404

        # TODO: add caching
        # try to get all the projects for the org even though it's possible they don't have access
        projects = Project.objects.filter(organization=organization, status=ProjectStatus.VISIBLE,)[
            0:1000
        ]  # only get 1000 because let's be reasonable

        # TODO: add logic to make sure we only show for orgs with 100+ relevant transactions
        # for each category

        # Web vitals: p75 for LCP and FCP
        # Mobile vitals: Cold Start and Warm Start
        with self.handle_query_errors():
            result = discover.query(
                query="transaction.duration:<15m transaction.op:pageload event.type:transaction",
                selected_columns=[
                    "p75(measurements.lcp)",
                    "p75(measurements.fcp)",
                    "measurements.app_start_cold",
                    "measurements.app_start_warm",
                ],
                limit=1,
                params={
                    "start": timezone.now() - timedelta(days=7),
                    "end": timezone.now(),
                    "organization_id": organization.id,
                    "project_id": [p.id for p in projects],
                },
                referrer="api.organization-vitals",
            )
            # only a single result
            data = result["data"][0]
            # map the names
            output = {}
            for key, val in data.items():
                output[NAME_MAPPING[key]] = val
            return self.respond(output)
