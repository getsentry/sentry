from django.db.models import Q, prefetch_related_objects
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.team import TeamEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import InviteStatus, OrganizationMemberTeam


@register(OrganizationMemberTeam)
class DetailedOrganizationMemberTeamSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.team = kwargs.pop("team", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        prefetch_related_objects(item_list, "organizationmember")
        prefetch_related_objects(item_list, "organizationmember__user")

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

    def serialize(self, obj, attrs, user):
        org_member = attrs["org_member"]
        org_member["teamRole"] = obj.role
        org_member["teamSlug"] = self.team.slug
        return org_member


@region_silo_endpoint
class TeamMembersEndpoint(TeamEndpoint):
    def get(self, request: Request, team) -> Response:
        queryset = OrganizationMemberTeam.objects.filter(
            Q(organizationmember__user__is_active=True) | Q(organizationmember__user__isnull=True),
            organizationmember__organization=team.organization,
            organizationmember__invite_status=InviteStatus.APPROVED.value,
            team=team,
        )
        serializer = DetailedOrganizationMemberTeamSerializer(team=team)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=(
                "organizationmember__user__name",
                "organizationmember__user__email",
                "organizationmember__email",
                "id",
            ),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )
