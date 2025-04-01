from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_member.utils import RelaxedMemberPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.organization import Organization
from sentry.models.organizationmemberinvite import OrganizationMemberInvite

MISSING_FEATURE_MESSAGE = "Your organization does not have access to this feature."


@region_silo_endpoint
class OrganizationMemberInviteDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (RelaxedMemberPermission,)

    def convert_args(
        self,
        request: Request,
        member_invite_id: str,
        organization_id_or_slug: str | int | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, organization_id_or_slug, *args, **kwargs)

        try:
            kwargs["invited_member"] = OrganizationMemberInvite.objects.get(
                id=int(member_invite_id)
            )
        except OrganizationMemberInvite.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs

    def get(
        self,
        request: Request,
        organization: Organization,
        invited_member: OrganizationMemberInvite,
    ) -> Response:
        """
        Retrieve an invited organization member's details.
        """
        if not features.has(
            "organizations:new-organization-member-invite", organization, actor=request.user
        ):
            return Response({"detail": MISSING_FEATURE_MESSAGE}, status=403)
        return Response(serialize(invited_member, request.user))

    def put(
        self, request: Request, organization: Organization, invited_member: OrganizationMemberInvite
    ) -> Response:
        raise NotImplementedError

    def delete(
        self, request: Request, organization: Organization, invited_member: OrganizationMemberInvite
    ) -> Response:
        raise NotImplementedError
