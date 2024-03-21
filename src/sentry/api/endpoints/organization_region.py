from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryPermission
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.types.region import get_region_by_name
from sentry.utils.types import Any


class OrganizationRegionEndpointPermissions(SentryPermission):
    # Although this permission set is a bit weird, we need to have
    # project:read for integration auth tokens, org:ci for org auth tokens
    # and org:read for user auth tokens.
    scope_map = {"GET": ["project:read", "org:ci", "org:read"]}

    def has_object_permission(self, request, view, org_mapping: OrganizationMapping):
        if request.auth is None:
            try:
                OrganizationMemberMapping.objects.get(
                    user_id=request.user.id, organization_id=org_mapping.organization_id
                )
                return True
            except OrganizationMemberMapping.DoesNotExist:
                return False

        is_org_or_api_token = (
            request.auth.kind == "org_auth_token" or request.auth.kind == "api_token"
        )

        if is_org_or_api_token and request.auth.organization_id == org_mapping.organization_id:
            return True

        return False


@control_silo_endpoint
class OrganizationRegionEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationRegionEndpointPermissions,)

    def convert_args(
        self, request: Request, organization_slug: str | None = None, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        if not organization_slug:
            raise ResourceDoesNotExist

        try:
            org_mapping: OrganizationMapping = OrganizationMapping.objects.get(
                slug=organization_slug
            )
        except OrganizationMapping.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, org_mapping)

        kwargs["organization_mapping"] = org_mapping
        return (args, kwargs)

    def get(self, request: Request, organization_mapping: OrganizationMapping) -> Response:
        region_data = get_region_by_name(organization_mapping.region_name)

        assert region_data, "A region should exist for every organization mapping"

        return self.respond(
            {
                "regionName": region_data.name,
                "regionUrl": region_data.to_url(""),
            }
        )
