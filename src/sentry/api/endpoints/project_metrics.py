from collections.abc import Mapping, Sequence
from enum import Enum
from typing import Optional, cast

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_blocking import MetricBlockingSerializer
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.sentry_metrics.visibility import (
    MalformedBlockedMetricsPayloadError,
    block_metric,
    block_tags_of_metric,
    unblock_metric,
    unblock_tags_of_metric,
)
from sentry.sentry_metrics.visibility.metrics_blocking import MetricBlocking
from sentry.snuba.metrics.naming_layer.mri import is_mri
from sentry.utils import metrics


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

    def _get_sanitized_tags(self, request: Request) -> Sequence[str]:
        tags = request.data.get("tags")
        if not tags:
            raise InvalidParams("You must supply at least one tag to block")

        # For now, we want to disallow any glob in the tags, since it might cause issues in Relay.
        return [tag.replace("*", "") for tag in tags]

    def _create_audit_log_entry(
        self, event_id: str, metric_mri: str, tags: Sequence[str] | None, project: Project
    ):
        audit_data = {"metric_mri": metric_mri, "project_slug": project.slug}
        if tags is not None:
            audit_data["tags"] = tags

        self.create_audit_entry(
            request=self.request,
            organization_id=project.organization_id,
            target_object=project.id,
            event=audit_log.get_event_id(event_id),
            data=audit_data,
        )

    def _handle_by_operation_type(
        self, request: Request, project: Project, metric_operation_type: MetricOperationType
    ) -> MetricBlocking:
        metric_mri = request.data.get("metricMri")
        if not is_mri(metric_mri):
            raise InvalidParams("You must supply a valid metric mri")

        metric_mri = cast(str, metric_mri)
        patched_metrics: Mapping[int, MetricBlocking] = {}

        if metric_operation_type == MetricOperationType.BLOCK_METRIC:
            patched_metrics = block_metric(metric_mri, [project])
            self._create_audit_log_entry("METRIC_BLOCK", metric_mri, None, project)
        elif metric_operation_type == MetricOperationType.UNBLOCK_METRIC:
            patched_metrics = unblock_metric(metric_mri, [project])
            self._create_audit_log_entry("METRIC_UNBLOCK", metric_mri, None, project)
        elif metric_operation_type == MetricOperationType.BLOCK_TAGS:
            tags = self._get_sanitized_tags(request)
            patched_metrics = block_tags_of_metric(metric_mri, set(tags), [project])
            self._create_audit_log_entry("METRIC_TAGS_BLOCK", metric_mri, tags, project)
        elif metric_operation_type == MetricOperationType.UNBLOCK_TAGS:
            tags = self._get_sanitized_tags(request)
            patched_metrics = unblock_tags_of_metric(metric_mri, set(tags), [project])
            self._create_audit_log_entry("METRIC_TAGS_UNBLOCK", metric_mri, tags, project)

        metrics.incr(
            key="ddm.metrics_visibility.apply_operation",
            amount=1,
            tags={"operation_type": metric_operation_type.value},
        )

        return patched_metrics[project.id]

    def put(self, request: Request, project: Project) -> Response:
        metric_operation_type = MetricOperationType.from_request(request)
        if not metric_operation_type:
            raise InvalidParams(
                f"You must supply a valid operation, which must be one of {MetricOperationType.available_ops()}"
            )

        try:
            patched_metric = self._handle_by_operation_type(request, project, metric_operation_type)
        except MalformedBlockedMetricsPayloadError:
            # In case one metric fails to be inserted, we abort the entire insertion since the project options are
            # likely to be corrupted.
            return Response(
                {"detail": "The blocked metrics settings are corrupted, try again"}, status=500
            )

        return Response(
            serialize(patched_metric, request.user, MetricBlockingSerializer()), status=200
        )
