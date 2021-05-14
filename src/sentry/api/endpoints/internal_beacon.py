import logging

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.tasks.beacon import send_beacon_metric

logger = logging.getLogger("beacon")


class InternalBeaconEndpoint(Endpoint):
    permission_classes = ()

    def post(self, request):
        # Because this is used by the frontend, we want our frontend calls to
        # be batched in order to reduce the number requests.
        send_beacon_metric.delay(metrics=request.data.get("batch_data", []))

        return Response(status=204)
