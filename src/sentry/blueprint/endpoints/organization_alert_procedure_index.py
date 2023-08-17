from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationAlertProcedureIndexEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        pass
