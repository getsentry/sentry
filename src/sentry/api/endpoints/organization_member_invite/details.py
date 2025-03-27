from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_member.utils import RelaxedMemberPermission
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.organizationmemberinvite import OrganizationMemberInvite


class OrganizationMemberIndexDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (RelaxedMemberPermission,)

    def get(
        self,
        request: Request,
        invited_member: OrganizationMemberInvite,
    ) -> Response:
        """
        Retrieve an invited organization member's details.
        """
        return Response(serialize(invited_member, request.user))

    def put(
        self, request: Request, organization: Organization, invited_member: OrganizationMemberInvite
    ) -> Response:
        raise NotImplementedError

    def delete(
        self, request: Request, organization: Organization, invited_member: OrganizationMemberInvite
    ) -> Response:
        raise NotImplementedError
