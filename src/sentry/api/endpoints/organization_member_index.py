from __future__ import absolute_import

from django.db.models import Q

from sentry.api.bases.organization import (OrganizationEndpoint, OrganizationPermission)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember


class MemberPermission(OrganizationPermission):
    scope_map = {
        'GET': ['member:read', 'member:write', 'member:admin'],
        'POST': ['member:write', 'member:admin'],
        'PUT': ['member:write', 'member:admin'],
        'DELETE': ['member:admin'],
    }


class OrganizationMemberIndexEndpoint(OrganizationEndpoint):
    permission_classes = (MemberPermission, )

    def get(self, request, organization):
        queryset = OrganizationMember.objects.filter(
            Q(user__is_active=True) | Q(user__isnull=True),
            organization=organization,
        ).select_related('user').order_by('email', 'user__email')

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
