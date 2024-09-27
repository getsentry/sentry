from django.db.models import Q, prefetch_related_objects
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.organization_member.response import OrganizationMemberResponse
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organizationmember import InviteStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.users.api.serializers.user import UserSerializerResponse


class OrganizationMemberOnTeamResponse(OrganizationMemberResponse):
    # NOTE: We override users to be required b/c team members will always have
    # an existing user to be part of a team.
    user: UserSerializerResponse  # type: ignore[misc]
    teamRole: str | None
    teamSlug: str


@register(OrganizationMemberTeam)
class DetailedOrganizationMemberTeamSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.team = kwargs.pop("team", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "organizationmember")

        org_member_set = serialize(
            {
                org_member_team.organizationmember
                for org_member_team in item_list
                if org_member_team.organizationmember
            }
        )
        org_member_dict = {om["id"]: om for om in org_member_set}

        attrs = {}
        for org_member_team in item_list:
            attrs[org_member_team] = {
                "org_member": org_member_dict[f"{org_member_team.organizationmember_id}"]
            }
        return attrs

    def serialize(self, obj, attrs, user, **kwargs) -> OrganizationMemberOnTeamResponse:
        org_member = attrs["org_member"]
        org_member["teamRole"] = obj.role
        org_member["teamSlug"] = self.team.slug
        return org_member


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class TeamMembersEndpoint(TeamEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List a Team's Members",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.TEAM_ID_OR_SLUG,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListMemberOnTeamResponse", list[OrganizationMemberOnTeamResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.LIST_TEAM_MEMBERS,
    )
    def get(self, request: Request, team) -> Response:
        """
        List all members on a team.

        The response will not include members with pending invites.
        """
        queryset = OrganizationMemberTeam.objects.filter(
            Q(organizationmember__user_is_active=True, organizationmember__user_id__isnull=False)
            | Q(organizationmember__user_id__isnull=True),
            organizationmember__organization=team.organization,
            organizationmember__invite_status=InviteStatus.APPROVED.value,
            team=team,
        )
        serializer = DetailedOrganizationMemberTeamSerializer(team=team)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=(
                "organizationmember__email",
                "id",
            ),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )
