from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, TypedDict, cast

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.events.builder import SpansIndexedQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer


class TraceResult(TypedDict):
    trace: str
    numSpans: int
    name: str | None
    duration: int
    spans: list[Mapping[str, Any]]


class OrganizationTracesSerializer(serializers.Serializer):
    field = serializers.ListField(required=True, allow_empty=False, child=serializers.CharField())
    query = serializers.CharField(required=False)
    maxSpansPerTrace = serializers.IntegerField(default=1, min_value=1, max_value=100)


@region_silo_endpoint
class OrganizationTracesEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params, params = self.get_snuba_dataclass(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationTracesSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        per_page = self.get_per_page(request)

        def data_fn(offset: int, limit: int):
            with handle_query_errors():
                sample_rate = options.get("traces.sample-list.sample-rate")
                if sample_rate <= 0:
                    sample_rate = None
                builder = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=serialized.get("query", ""),
                    selected_columns=["trace", "timestamp"] + serialized["field"],
                    # The orderby is intentionally `None` here as this query is much faster
                    # if we let Clickhouse decide which order to return the results in.
                    # This also means we cannot order by any columns or paginate.
                    orderby=None,
                    limit=per_page * serialized["maxSpansPerTrace"],
                    limitby=("trace", serialized["maxSpansPerTrace"]),
                    sample_rate=sample_rate,
                    config=QueryBuilderConfig(
                        transform_alias_to_input_format=True,
                    ),
                )
                span_results = builder.run_query(Referrer.API_TRACE_EXPLORER_SPANS_LIST.value)
                span_results = builder.process_results(span_results)

            fields = span_results["meta"].pop("fields", {})
            meta = {
                **span_results["meta"],
                "fields": {field: fields[field] for field in serialized["field"]},
            }

            if not span_results["data"]:
                return {"data": [], "meta": meta}

            spans_by_trace: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)
            for row in span_results["data"]:
                spans_by_trace[row["trace"]].append(row)

            trace_spans_count = sorted(
                [(trace, len(spans)) for trace, spans in spans_by_trace.items()],
                key=lambda item: item[0],
                reverse=True,
            )[:per_page]

            spans_by_trace = {trace: spans_by_trace[trace] for trace, _ in trace_spans_count}

            min_timestamp = snuba_params.end
            max_timestamp = snuba_params.start
            assert min_timestamp is not None
            assert max_timestamp is not None
            for spans in spans_by_trace.values():
                for span in spans:
                    timestamp = datetime.fromisoformat(span["timestamp"])
                    if timestamp < min_timestamp:
                        min_timestamp = timestamp
                    if timestamp > max_timestamp:
                        max_timestamp = timestamp

            # TODO: move to use `update_snuba_params_with_timestamp`
            time_buffer = options.get("performance.traces.trace-explorer-buffer-hours")
            buffer = timedelta(hours=time_buffer)
            params["start"] = min_timestamp - buffer
            params["end"] = max_timestamp + buffer
            snuba_params.start = min_timestamp - buffer
            snuba_params.end = max_timestamp + buffer

            with handle_query_errors():
                builder = SpansIndexedQueryBuilder(
                    Dataset.SpansIndexed,
                    cast(ParamsType, params),
                    snuba_params=snuba_params,
                    query=f"trace:[{', '.join(spans_by_trace.keys())}]",
                    selected_columns=["trace", "count()", "trace_name()", "elapsed()"],
                    limit=len(spans_by_trace),
                    config=QueryBuilderConfig(
                        functions_acl=["trace_name", "elapsed"],
                        transform_alias_to_input_format=True,
                    ),
                )
                trace_results = builder.run_query(Referrer.API_TRACE_EXPLORER_TRACES_META.value)
                trace_results = builder.process_results(trace_results)

            traces: list[TraceResult] = [
                {
                    "trace": row["trace"],
                    "numSpans": row["count()"],
                    "name": row["trace_name()"],
                    "duration": row["elapsed()"],
                    "spans": [
                        {field: span[field] for field in serialized["field"]}
                        for span in spans_by_trace[row["trace"]]
                    ],
                }
                for row in trace_results["data"]
            ]

            return {"data": traces, "meta": meta}

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: self.handle_results_with_meta(
                request,
                organization,
                params["project_id"],
                results,
                standard_meta=True,
                dataset=Dataset.SpansIndexed,
            ),
        )
