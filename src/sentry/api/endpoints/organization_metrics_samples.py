import sentry_sdk
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.samples_list import get_sample_list_executor_cls
from sentry.snuba.metrics.naming_layer.mri import is_mri
from sentry.snuba.referrer import Referrer
from sentry.utils.dates import get_rollup_from_request
from sentry.utils.snuba import SnubaError


class MetricsSamplesSerializer(serializers.Serializer):
    mri = serializers.CharField(required=True)
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    max = serializers.FloatField(required=False)
    min = serializers.FloatField(required=False)
    operation = serializers.CharField(required=False)
    query = serializers.CharField(required=False)
    referrer = serializers.CharField(required=False)
    sort = serializers.CharField(required=False)

    def validate_mri(self, mri: str) -> str:
        if not is_mri(mri):
            raise serializers.ValidationError(f"Invalid MRI: {mri}")

        return mri


@region_silo_endpoint
class OrganizationMetricsSamplesEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    snuba_methods = ["GET"]

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        try:
            rollup = get_rollup_from_request(
                request,
                snuba_params.end_date - snuba_params.start_date,
                default_interval=None,
                error=InvalidSearchQuery(),
            )
        except InvalidSearchQuery:
            rollup = 3600  # use a default of 1 hour

        serializer = MetricsSamplesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data

        executor_cls = get_sample_list_executor_cls(serialized["mri"])
        if not executor_cls:
            raise ParseError(f"Unsupported MRI: {serialized['mri']}")

        sort = serialized.get("sort")
        if sort is not None:
            column = sort[1:] if sort.startswith("-") else sort
            if not executor_cls.supports_sort(column):
                raise ParseError(f"Unsupported sort: {sort} for MRI")

        executor = executor_cls(
            mri=serialized["mri"],
            snuba_params=snuba_params,
            fields=serialized["field"],
            operation=serialized.get("operation"),
            query=serialized.get("query", ""),
            min=serialized.get("min"),
            max=serialized.get("max"),
            sort=serialized.get("sort"),
            rollup=rollup,
            referrer=Referrer.API_ORGANIZATION_METRICS_SAMPLES,
        )

        with handle_query_errors():
            try:
                return self.paginate(
                    request=request,
                    paginator=GenericOffsetPaginator(data_fn=executor.get_matching_spans),
                    on_results=lambda results: self.handle_results_with_meta(
                        request,
                        organization,
                        snuba_params.project_ids,
                        results,
                        standard_meta=True,
                    ),
                )
            except SnubaError as exc:
                sentry_sdk.capture_exception(exc)
                raise
