from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus


@control_silo_endpoint
class ApiApplicationsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionAuthentication,)
    permission_classes = (SentryIsAuthenticated,)

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
        # Check if this should be a public client (no client_secret)
        # Public clients are used for CLIs, native apps, and SPAs that
        # cannot securely store a client secret (RFC 6749 §2.1)
        is_public = request.data.get("isPublic", False)

        if is_public:
            # Public clients have no client_secret
            app = ApiApplication.objects.create(
                owner_id=request.user.id,
                client_secret=None,
            )
        else:
            # Confidential clients get an auto-generated secret
            app = ApiApplication.objects.create(owner_id=request.user.id)

        return Response(serialize(app, request.user), status=201)
