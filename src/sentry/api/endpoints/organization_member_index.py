from __future__ import absolute_import

from django.db.models import Q
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember


class MemberPermission(OrganizationPermission):
    scope_map = {
        'GET': ['member:read', 'member:write', 'member:delete'],
        'POST': ['member:write', 'member:delete'],
        'PUT': ['member:write', 'member:delete'],
        'DELETE': ['member:delete'],
    }


class OrganizationMemberIndexEndpoint(OrganizationEndpoint):
    permission_classes = (MemberPermission,)

    def get(self, request, organization):
        queryset = OrganizationMember.objects.filter(
            Q(user__is_active=True) | Q(user__isnull=True),
            organization=organization,
        ).select_related('user')

        member_list = sorted(
            queryset,
            key=lambda x: x.user.get_display_name() if x.user_id else x.email
        )

        context = serialize(member_list, request.user)

        return Response(context)
