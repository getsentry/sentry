from __future__ import absolute_import

from sentry import roles
from sentry.models import (
    AuthProvider, OrganizationAccessRequest, OrganizationMember,
    OrganizationMemberTeam
)
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    def handle(self, request, organization):
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
            member_list.append((om, needs_sso))

        # if the member is not the only owner we allow them to leave the org
        member_can_leave = any(
            1 for om, _ in member_list
            if (om.role == roles.get_top_dog().id
                and om.user != request.user
                and om.user is not None)
        )

        can_approve_requests_globally = (
            request.access.has_scope('member:write')
            or request.access.has_scope('org:write')
        )
        can_remove_members = request.access.has_scope('member:delete')

        # pending requests
        if can_approve_requests_globally:
            access_requests = list(OrganizationAccessRequest.objects.filter(
                team__organization=organization,
            ).select_related('team', 'member__user'))
        elif request.access.has_scope('team:write'):
            access_requests = list(OrganizationAccessRequest.objects.filter(
                team__in=OrganizationMemberTeam.objects.filter(
                    organizationmember__organization=organization,
                    organizationmember__user=request.user,
                ).values('team'),
            ).select_related('team', 'member__user'))
        else:
            access_requests = []

        context = {
            'org_has_sso': auth_provider is not None,
            'member_list': member_list,
            'request_list': access_requests,
            'ref': request.GET.get('ref'),
            'can_remove_members': can_remove_members,
            'member_can_leave': member_can_leave,
        }

        return self.respond('sentry/organization-members.html', context)
