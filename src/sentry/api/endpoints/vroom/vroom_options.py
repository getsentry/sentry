from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint
from sentry.utils import metrics

from .options import get_vroom_options


class VroomOptionsEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()  # TODO: add a sensible authentication for service-to-service
    permission_classes = ()
    owner = owner = ApiOwner.PROFILING
    enforce_rate_limit = False

    @metrics.wraps("vroom_options.request")
    def get(self, request: Request):
        return Response(get_vroom_options(), status=200)
