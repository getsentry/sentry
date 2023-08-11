from __future__ import annotations

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.user import UserPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Organization, User
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service


@region_silo_endpoint
class UserOrganizationsEndpoint(Endpoint):
    permission_classes = (UserPermission,)

    def convert_args(self, request: Request, user_id: int, *args, **kwargs):
        user: RpcUser | User | None = None

        if user_id == "me":
            if not request.user.is_authenticated:
                raise ResourceDoesNotExist
            if isinstance(request.user, User) or isinstance(request.user, RpcUser):
                user = request.user
        else:
            user = user_service.get_user(user_id=user_id)

        if not user:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, user)

        kwargs["user"] = user
        return args, kwargs

    def get(self, request: Request, user: RpcUser) -> Response:
        queryset = Organization.objects.get_for_user_ids({user.id})

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
