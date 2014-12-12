from __future__ import absolute_import

from collections import defaultdict

from sentry.models import (
    OrganizationMember, OrganizationMemberTeams, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def handle(self, request, organization):
        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        else:
            authorizing_access = OrganizationMember.objects.get(
                user=request.user,
            ).type

        queryset = OrganizationMemberTeams.objects.filter(
            organizationmember__organization=organization,
        ).select_related('team')

        team_map = defaultdict(list)
        for omt in queryset:
            team_map[omt.organizationmember_id].append(omt.team)

        queryset = OrganizationMember.objects.filter(
            organization=organization,
        ).select_related('user')

        queryset = sorted(queryset, key=lambda x: x.email or x.user.get_display_name())

        member_list = []
        for om in queryset:
            member_list.append((om, team_map[om.id]))

        context = {
            'member_list': member_list,
            'authorizing_access': authorizing_access,
        }

        return self.respond('sentry/organization-members.html', context)
