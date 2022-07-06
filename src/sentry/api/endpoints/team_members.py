from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import Serializer, register, serialize
from sentry.models import InviteStatus
from sentry.models.organizationmemberteam import OrganizationMemberTeam


@register(OrganizationMemberTeam)
class DetailedOrganizationMemberTeamSerializer(Serializer):
    def __init__(self, *args, **kwargs):
        self.team = kwargs.pop("team", None)
        super().__init__(*args, **kwargs)

    def get_attrs(self, item_list, user, **kwargs):
        attrs = {}
        for org_member_team in item_list:
            attrs[org_member_team] = {
                "org_member": org_member_team.organizationmember,
                "user": org_member_team.organizationmember.user,
            }
        return attrs

    def serialize(self, obj, attrs, user):
        org_member = serialize(attrs["org_member"])
        org_member["user"] = serialize(attrs["user"])
        org_member["teamRoles"] = [{"teamSlug": self.team.slug, "role": obj.role}]
        return org_member


class TeamMembersEndpoint(TeamEndpoint):
    def get(self, request: Request, team) -> Response:
        queryset = (
            OrganizationMemberTeam.objects.filter(
                Q(organizationmember__user__is_active=True)
                | Q(organizationmember__user__isnull=True),
                organizationmember__organization=team.organization,
                organizationmember__invite_status=InviteStatus.APPROVED.value,
                team=team,
            )
            .prefetch_related("organizationmember")
            .prefetch_related("organizationmember__user")
        )

        serializer = DetailedOrganizationMemberTeamSerializer(team=team)

        members = serialize(list(queryset), request.user, serializer=serializer)
        result = sorted(members, key=lambda x: x["user"]["name"] or x["user"]["email"])
        return Response(result)
