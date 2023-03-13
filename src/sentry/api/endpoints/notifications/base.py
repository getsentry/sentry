from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.permissions import SuperuserPermission


class BaseNotificationActionsEndpoint(OrganizationEndpoint):
    permission_classes = (SuperuserPermission,)
