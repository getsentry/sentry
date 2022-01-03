from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import serialize
from sentry.db.models.query import in_iexact
from sentry.models import User
from sentry.search.utils import tokenize_query


class UserIndexEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request: Request) -> Response:
        queryset = User.objects.distinct()

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value)
                        | Q(username__icontains=value)
                        | Q(email__icontains=value)
                        | Q(emails__email__icontains=value)
                    )
                elif key == "id":
                    queryset = queryset.filter(
                        id__in=[request.user.id if v == "me" else v for v in value]
                    )
                elif key == "name":
                    queryset = queryset.filter(in_iexact("name", value))
                elif key == "email":
                    queryset = queryset.filter(in_iexact("email", value))
                elif key == "username":
                    queryset = queryset.filter(in_iexact("username", value))
                elif key == "is":
                    for v in value:
                        if v == "superuser":
                            queryset = queryset.filter(is_superuser=True)
                        else:
                            queryset = queryset.none()
                elif key == "permission":
                    queryset = queryset.filter(
                        userpermission__permission__in=[v.lower() for v in value]
                    )
                else:
                    queryset = queryset.none()

        status = request.GET.get("status")
        if status == "active":
            queryset = queryset.filter(is_active=True)
        elif status == "disabled":
            queryset = queryset.filter(is_active=False)

        order_by = "-date_joined"
        paginator_cls = DateTimePaginator

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=paginator_cls,
        )
