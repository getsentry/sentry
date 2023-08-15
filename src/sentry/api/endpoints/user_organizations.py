from __future__ import annotations

from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response
from typing_extensions import override

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

    @override
    def convert_args(self, request: Request, user_id: str | None = None, *args, **kwargs):
        user: RpcUser | User | None = None

        if user_id == "me":
            if not request.user.is_authenticated:
                raise ResourceDoesNotExist
            user = request.user
        elif user_id is not None:
            user = user_service.get_user(user_id=int(user_id))

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
