from __future__ import absolute_import
import six

from django.db.models import Q

from sentry.api.bases.organization import (OrganizationEndpoint, OrganizationPermission)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import OrganizationMember
from sentry.search.utils import tokenize_query


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

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'email':
                    queryset = queryset.filter(
                        Q(user__email__in=value) | Q(user__emails__email__in=value)
                    )

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
