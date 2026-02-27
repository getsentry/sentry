from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.types.region import get_global_directory
from sentry.users.api.bases.user import UserEndpoint, UserPermission
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


# Grants access to the list of regions where a user has organizations.
# This should only be accessible for the current user or
# system/superuser requests.
#
# This will also grant access via user auth tokens assuming the
# user ID matches the user that is being queried.
class UserRegionEndpointPermissions(UserPermission):
    scope_map = {"GET": ["org:read"]}

    def has_object_permission(
        self, request: Request, view: Any, user: User | RpcUser | None = None
    ) -> bool:
        if user and user.id == request.user.id and request.user.is_authenticated:
            return True
        if is_system_auth(request.auth):
            return True
        if is_active_superuser(request):
            return True

        return False


@control_silo_endpoint
class UserRegionsEndpoint(UserEndpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (UserRegionEndpointPermissions,)

    def get(self, request: Request, user: RpcUser, **kwargs: Any) -> Response:
        """
        Retrieve the Regions a User has membership in
        `````````````````````````````````````````````

        Returns a list of regions that the current user has membership in.
        :auth: required
        """
        organization_ids = OrganizationMemberMapping.objects.filter(user_id=user.id).values_list(
            "organization_id", flat=True
        )
        cell_names = (
            OrganizationMapping.objects.filter(organization_id__in=organization_ids)
            .distinct("region_name")
            .order_by("region_name")
            .values_list("region_name", flat=True)
        )
        directory = get_global_directory()
        localities = sorted(
            {
                loc
                for name in cell_names
                if (loc := directory.get_locality_for_cell(name)) is not None
            },
            key=lambda loc: loc.name,
        )
        regions = [loc.api_serialize() for loc in localities]
        payload = {
            "regions": regions,
        }
        return Response(payload)
