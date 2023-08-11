from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import OrganizationMapping, OrganizationMemberMapping, OrganizationStatus, User


@control_silo_endpoint
class UserOrganizationsEndpoint(UserEndpoint):
    def get(self, request: Request, user: User) -> Response:
        org_ids = OrganizationMemberMapping.objects.filter(user_id=user.id)
        queryset = OrganizationMapping.objects.filter(
            id__in=org_ids,
            status=OrganizationStatus.ACTIVE,
        )

        query = request.GET.get("query")
        if query:
            queryset = queryset.filter(Q(name__icontains=query) | Q(slug__icontains=query))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
