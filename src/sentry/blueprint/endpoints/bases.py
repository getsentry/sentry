from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint


@region_silo_endpoint
class BlueprintEndpoint(OrganizationEndpoint):
    permission_classes = ()
