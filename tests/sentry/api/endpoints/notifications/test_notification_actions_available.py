from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_flag import FlaggedOrganizationEndpoint


@region_silo_endpoint
class NotificationActionsAvailableEndpoint(FlaggedOrganizationEndpoint):
    pass
