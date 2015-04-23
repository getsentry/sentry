from __future__ import absolute_import

from collections import defaultdict

from sentry.models import (
    AuthProvider, OrganizationAccessRequest, OrganizationMember,
    OrganizationMemberTeam, OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    def handle(self, request, organization):
        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
            access_is_global = True
        else:
            member = OrganizationMember.objects.get(
                user=request.user,
                organization=organization,
            )
            authorizing_access = member.type
            access_is_global = member.has_global_access

        queryset = OrganizationMemberTeam.objects.filter(
            organizationmember__organization=organization,
            is_active=True,
        ).select_related('team')

        team_map = defaultdict(list)
        for omt in queryset:
            team_map[omt.organizationmember_id].append(omt.team)

        queryset = OrganizationMember.objects.filter(
            organization=organization,
        ).select_related('user')

        queryset = sorted(queryset, key=lambda x: x.email or x.user.get_display_name())

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            auth_provider = None

        member_list = []
        for om in queryset:
            needs_sso = bool(auth_provider and not getattr(om.flags, 'sso:linked'))
            member_list.append((om, team_map[om.id], needs_sso))

        # if the member is not the only owner we allow them to leave the org
        member_can_leave = any(
            1 for om, _, _ in member_list
            if (om.type == OrganizationMemberType.OWNER
                and om.user != request.user
                and om.user is not None)
        )

        # pending requests
        if access_is_global and authorizing_access <= OrganizationMemberType.ADMIN:
            access_requests = list(OrganizationAccessRequest.objects.filter(
                team__organization=organization,
            ).select_related('team', 'member__user'))
        else:
            access_requests = []

        context = {
            'org_has_sso': auth_provider is not None,
            'member_list': member_list,
            'request_list': access_requests,
            'ref': request.GET.get('ref'),
            'authorizing_access': authorizing_access,
            'member_can_leave': member_can_leave,
        }

        return self.respond('sentry/organization-members.html', context)
