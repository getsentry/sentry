from __future__ import annotations

from rest_framework.request import Request

from sentry.api.bases import OrganizationPermission
from sentry.api.bases.organization import OrganizationEndpoint


class OrganizationRequestChangeEndpointPermission(OrganizationPermission):
    # just requesting so read permission is enough
    scope_map = {
        "POST": ["org:read"],
    }

    def is_member_disabled_from_limit(self, request: Request, organization: object) -> bool:
        # disabled members need to be able to make requests
        return False


# This is a base endpoint which can be used when a member
# requests a change for their org which send an email to the appropriate
# person
class OrganizationRequestChangeEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationRequestChangeEndpointPermission,)
