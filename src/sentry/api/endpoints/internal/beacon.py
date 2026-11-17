import logging
from typing import TypedDict

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.tasks.beacon import send_beacon_metric

logger = logging.getLogger(__name__)

MAX_BATCH_METRIC_COUNT = 20
MAX_FIELDS_PER_METRIC = 20


class _MetricsData(TypedDict):
    batch_data: list[dict[str, str]]


class MetricsSerializer(serializers.Serializer[None, _MetricsData]):
    batch_data = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField(max_length=1024),
            allow_empty=False,
        ),
        max_length=MAX_BATCH_METRIC_COUNT,
    )

    def validate(self, attrs: _MetricsData) -> _MetricsData:
        attrs = super().validate(attrs)

        for metric in attrs["batch_data"]:
            if len(metric) > MAX_FIELDS_PER_METRIC:
                raise serializers.ValidationError(
                    {"batch_data": f"Dict size must be less than {MAX_FIELDS_PER_METRIC}"}
                )
        return attrs


@control_silo_endpoint
class InternalBeaconEndpoint(Endpoint):
    owner = ApiOwner.HYBRID_CLOUD
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = ()

    def post(self, request: Request) -> Response:
        serializer = MetricsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Because this is used by the frontend, we want our frontend calls to
        # be batched in order to reduce the number requests.
        send_beacon_metric.delay(metrics=request.data.get("batch_data", []))

        return Response(status=204)
