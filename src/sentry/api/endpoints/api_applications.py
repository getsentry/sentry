from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication, control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ApiApplication, ApiApplicationStatus


@control_silo_endpoint
class ApiApplicationsEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        queryset = ApiApplication.objects.filter(
            owner_id=request.user.id, status=ApiApplicationStatus.active
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="name",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request) -> Response:
        app = ApiApplication.objects.create(owner_id=request.user.id)

        return Response(serialize(app, request.user), status=201)
