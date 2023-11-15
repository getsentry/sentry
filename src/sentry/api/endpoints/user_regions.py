from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.types.region import get_region_by_name


@control_silo_endpoint
class UserRegionsEndpoint(UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, **kwargs) -> Response:
        """
        Retrieve the Regions a User has membership in
        `````````````````````````````````````````````

        Returns a list of regions that the current user has membership in.

        :auth: required
        """
        organization_ids = OrganizationMemberMapping.objects.filter(
            user_id=request.user.id
        ).values_list("organization_id", flat=True)
        org_mappings = (
            OrganizationMapping.objects.filter(organization_id__in=organization_ids)
            .distinct("region_name")
            .values_list("region_name", flat=True)
        )
        regions = [get_region_by_name(region_name).api_serialize() for region_name in org_mappings]
        payload = {
            "regions": regions,
        }
        return Response(payload)
