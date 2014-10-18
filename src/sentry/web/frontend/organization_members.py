from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberType
from sentry.web.frontend.base import OrganizationView


class OrganizationMembersView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        context = {
            'member_list': OrganizationMember.objects.filter(
                organization=organization
            ).select_related('user'),
        }

        return self.respond('sentry/organization-members.html', context)
