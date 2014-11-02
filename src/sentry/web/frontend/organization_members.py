from __future__ import absolute_import

from collections import defaultdict

from sentry.models import (
    OrganizationMember, OrganizationMemberTeams, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        queryset = OrganizationMemberTeams.objects.filter(
            organizationmember__organization=organization,
        ).select_related('team')

        team_map = defaultdict(list)
        for omt in queryset:
            team_map[omt.organizationmember_id].append(omt.team)

        queryset = OrganizationMember.objects.filter(
            organization=organization,
        ).select_related('user')

        member_list = []
        for om in queryset:
            member_list.append((om, team_map[om.id]))

        context = {
            'member_list': member_list,
        }

        return self.respond('sentry/organization-members.html', context)
