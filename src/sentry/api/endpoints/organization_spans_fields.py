import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Condition, Op

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import handle_query_errors
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tagstore.types import TagKey, TagValue


class OrganizationSpansFieldsEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE


@region_silo_endpoint
class OrganizationSpansFieldsEndpoint(OrganizationSpansFieldsEndpointBase):
    snuba_methods = ["GET"]

    def get(self, request: Request, organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        max_span_tags = options.get("performance.spans-tags-key.max")

        with handle_query_errors():
            # This has the limitations that we cannot paginate and
            # we do not provide any guarantees around which tag keys
            # are returned if the total exceeds the limit.
            builder = SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params={},
                snuba_params=snuba_params,
                query=None,
                selected_columns=["array_join(tags.key)"],
                orderby=None,
                limitby=("array_join(tags.key)", 1),
                limit=max_span_tags,
                sample_rate=options.get("performance.spans-tags-key.sample-rate"),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                    functions_acl=["array_join"],
                ),
            )

            results = builder.process_results(builder.run_query(Referrer.API_SPANS_TAG_KEYS.value))

        results["data"].sort(key=lambda row: row["array_join(tags.key)"])

        paginator = ChainPaginator(
            [[TagKey(row["array_join(tags.key)"]) for row in results["data"]]],
            max_limit=max_span_tags,
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_span_tags,
            max_per_page=max_span_tags,
        )


@region_silo_endpoint
class OrganizationSpansFieldValuesEndpoint(OrganizationSpansFieldsEndpointBase):
    snuba_methods = ["GET"]

    def get(self, request: Request, organization, key: str) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return self.paginate(
                request=request,
                paginator=ChainPaginator([]),
            )

        sentry_sdk.set_tag("query.tag_key", key)

        max_span_tag_values = options.get("performance.spans-tags-values.max")

        executor = SpanFieldValuesAutocompletionExecutor(
            snuba_params=snuba_params,
            key=key,
            query=request.GET.get("query"),
            max_span_tag_values=max_span_tag_values,
        )
        tag_values = executor.execute()

        tag_values.sort(key=lambda tag: tag.value)

        paginator = ChainPaginator([tag_values], max_limit=max_span_tag_values)

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
            default_per_page=max_span_tag_values,
            max_per_page=max_span_tag_values,
        )


class SpanFieldValuesAutocompletionExecutor:
    ID_KEYS = {
        "id",
        "span_id",
        "parent_span",
        "parent_span_id",
        "trace",
        "trace_id",
        "transaction.id",
        "transaction_id",
        "segment.id",
        "segment_id",
        "profile.id",
        "profile_id",
        "replay.id",
        "replay_id",
    }
    NUMERIC_KEYS = {"span.duration", "span.self_time"}
    TIMESTAMP_KEYS = {"timestamp"}
    PROJECT_SLUG_KEYS = {"project", "project.name"}
    PROJECT_ID_KEYS = {"project.id"}
    SPAN_STATUS_KEYS = {"span.status"}

    def __init__(
        self,
        snuba_params: SnubaParams,
        key: str,
        query: str | None,
        max_span_tag_values: int,
    ):
        self.snuba_params = snuba_params
        self.key = key
        self.query = query
        self.max_span_tag_values = max_span_tag_values

    def execute(self) -> list[TagValue]:
        if (
            self.key in self.NUMERIC_KEYS
            or self.key in self.ID_KEYS
            or self.key in self.TIMESTAMP_KEYS
        ):
            return self.noop_autocomplete_function()

        if self.key in self.PROJECT_ID_KEYS:
            return self.project_id_autocomplete_function()

        if self.key in self.PROJECT_SLUG_KEYS:
            return self.project_slug_autocomplete_function()

        if self.key in self.SPAN_STATUS_KEYS:
            return self.span_status_autocomplete_function()

        return self.default_autocomplete_function()

    def noop_autocomplete_function(self) -> list[TagValue]:
        return []

    def project_id_autocomplete_function(self) -> list[TagValue]:
        return [
            TagValue(
                key=self.key,
                value=str(project.id),
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for project in self.snuba_params.projects
            if not self.query or self.query in str(project.id)
        ]

    def project_slug_autocomplete_function(self) -> list[TagValue]:
        return [
            TagValue(
                key=self.key,
                value=project.slug,
                times_seen=None,
                first_seen=None,
                last_seen=None,
            )
            for project in self.snuba_params.projects
            if not self.query or self.query in project.slug
        ]

    def span_status_autocomplete_function(self) -> list[TagValue]:
        query = self.get_autocomplete_query_base()

        # If the user specified a query, we only want to return
        # statuses that match their query. So filter down to just
        # the matching span statuses, and translate to the codes.
        if self.query:
            status_codes = [
                status for status, value in SPAN_STATUS_CODE_TO_NAME.items() if self.query in value
            ]
            query.where.append(Condition(query.resolve_column("span.status"), Op.IN, status_codes))

        return self.get_autocomplete_results(query)

    def default_autocomplete_function(self) -> list[TagValue]:
        query = self.get_autocomplete_query_base()

        if self.query:
            where, _ = query.resolve_conditions(f"{self.key}:*{self.query}*")
            query.where.extend(where)

        return self.get_autocomplete_results(query)

    def get_autocomplete_query_base(self) -> BaseQueryBuilder:
        with handle_query_errors():
            return SpansIndexedQueryBuilder(
                Dataset.SpansIndexed,
                params={},
                snuba_params=self.snuba_params,
                selected_columns=[self.key, "count()", "min(timestamp)", "max(timestamp)"],
                orderby="-count()",
                limit=self.max_span_tag_values,
                sample_rate=options.get("performance.spans-tags-key.sample-rate"),
                config=QueryBuilderConfig(
                    transform_alias_to_input_format=True,
                ),
            )

    def get_autocomplete_results(self, query: BaseQueryBuilder) -> list[TagValue]:
        with handle_query_errors():
            results = query.process_results(query.run_query(Referrer.API_SPANS_TAG_KEYS.value))

        return [
            TagValue(
                key=self.key,
                value=row[self.key],
                times_seen=row["count()"],
                first_seen=row["min(timestamp)"],
                last_seen=row["max(timestamp)"],
            )
            for row in results["data"]
            if row[self.key] is not None
        ]
