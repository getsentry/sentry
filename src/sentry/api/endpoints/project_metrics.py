from enum import Enum
from typing import Optional, Sequence, cast

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.sentry_metrics.visibility import (
    MalformedBlockedMetricsPayloadError,
    block_metric,
    block_tags_of_metric,
    unblock_metric,
    unblock_tags_of_metric,
)
from sentry.snuba.metrics.naming_layer.mri import is_mri


class MetricOperationType(Enum):
    BLOCK_METRIC = "blockMetric"
    BLOCK_TAGS = "blockTags"
    UNBLOCK_METRIC = "unblockMetric"
    UNBLOCK_TAGS = "unblockTags"

    @classmethod
    def from_request(cls, request: Request) -> Optional["MetricOperationType"]:
        operation_type = request.data.get("operationType")
        if not operation_type:
            return None

        for operation in cls:
            if operation.value == operation_type:
                return operation

        return None

    @classmethod
    def available_ops(cls) -> Sequence[str]:
        return [operation.value for operation in cls]


@region_silo_endpoint
class ProjectMetricsVisibilityEndpoint(ProjectEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def _handle_by_operation_type(
        self, request: Request, project: Project, metric_operation_type: MetricOperationType
    ):
        metric_mri = request.data.get("metricMri")
        if not is_mri(metric_mri):
            raise InvalidParams("You must supply a valid metric mri")

        metric_mri = cast(str, metric_mri)
        if metric_operation_type == MetricOperationType.BLOCK_METRIC:
            block_metric(metric_mri, [project])
        elif metric_operation_type == MetricOperationType.UNBLOCK_METRIC:
            unblock_metric(metric_mri, [project])
        elif metric_operation_type == MetricOperationType.BLOCK_TAGS:
            tags = request.data.get("tags") or []
            block_tags_of_metric(metric_mri, set(tags), [project])
        elif metric_operation_type == MetricOperationType.UNBLOCK_TAGS:
            tags = request.data.get("tags") or []
            unblock_tags_of_metric(metric_mri, set(tags), [project])

    def put(self, request: Request, project: Project) -> Response:
        metric_operation_type = MetricOperationType.from_request(request)
        if not metric_operation_type:
            raise InvalidParams(
                f"You must supply a valid operation, which must be one of {MetricOperationType.available_ops()}"
            )

        try:
            self._handle_by_operation_type(request, project, metric_operation_type)
        except MalformedBlockedMetricsPayloadError:
            # In case one metric fails to be inserted, we abort the entire insertion since the project options are
            # likely to be corrupted.
            return Response(
                {"detail": "The blocked metrics settings are corrupted, try again"}, status=500
            )

        return Response(status=200)
