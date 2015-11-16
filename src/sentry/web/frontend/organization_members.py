from __future__ import absolute_import

from django.db.models import Q

from sentry import roles
from sentry.models import (
    AuthProvider, OrganizationAccessRequest, OrganizationMember
)
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    def handle(self, request, organization):
        queryset = OrganizationMember.objects.filter(
            Q(user__is_active=True) | Q(user__isnull=True),
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

        # TODO(dcramer): ideally member:write could approve
        can_approve_requests_globally = request.access.has_scope('org:write')
        can_add_members = request.access.has_scope('org:write')
        can_remove_members = request.access.has_scope('member:delete')

        # pending requests
        if can_approve_requests_globally:
            access_requests = list(OrganizationAccessRequest.objects.filter(
                team__organization=organization,
                member__user__is_active=True,
            ).select_related('team', 'member__user'))
        elif request.access.has_scope('team:write') and request.access.teams:
            access_requests = list(OrganizationAccessRequest.objects.filter(
                member__user__is_active=True,
                team__in=request.access.teams,
            ).select_related('team', 'member__user'))
        else:
            access_requests = []

        context = {
            'org_has_sso': auth_provider is not None,
            'member_list': member_list,
            'request_list': access_requests,
            'ref': request.GET.get('ref'),
            'can_add_members': can_add_members,
            'can_remove_members': can_remove_members,
            'member_can_leave': member_can_leave,
        }

        return self.respond('sentry/organization-members.html', context)
