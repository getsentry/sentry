from __future__ import absolute_import

from django.db.models import Q

from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import (
    Organization, OrganizationMember, OrganizationStatus
)


class UserOrganizationsEndpoint(UserEndpoint):
    def get(self, request, user):
        queryset = Organization.objects.filter(
            status=OrganizationStatus.VISIBLE,
            id__in=OrganizationMember.objects.filter(
                user=user,
            ).values('organization'),
        )

        query = request.GET.get('query')
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(slug__icontains=query),
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
