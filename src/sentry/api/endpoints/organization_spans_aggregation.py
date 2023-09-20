import hashlib
from collections import defaultdict, namedtuple
from typing import Any, Dict, List, Mapping, TypedDict

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Function

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.models import Organization
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

EventSpan = namedtuple(
    "EventSpan",
    [
        "span_id",
        "is_segment",
        "parent_span_id",
        "group",
        "group_raw",
        "description",
        "op",
        "start_ms",
        "duration",
        "exclusive_time",
    ],
)


class EventSpans(TypedDict):
    transaction_id: str
    spans: List[EventSpan]


AggregateSpanRow = TypedDict(
    "AggregateSpanRow",
    {
        "node_fingerprint": str,
        "parent_node_fingerprint": str,
        "group": str,
        "description": str,
        "op": str,
        "start_ms": int,
        "avg(exclusive_time)": float,
        "avg(duration)": float,
        "is_segment": int,
        "avg(absolute_offset)": float,
        "avg(relative_offset)": float,
        "count()": int,
    },
)

NULL_GROUP = "00"


class AggregateSpans:
    def __init__(self) -> None:
        self.aggregated_tree: Dict[str, AggregateSpanRow] = {}

    def build_aggregate_span_tree(self, results: Mapping[str, Any]):
        for event in results["data"]:
            span_tree = {}
            root_span_id = None
            spans = event["spans"]

            for span_ in spans:
                span = EventSpan(*span_)
                span_id = getattr(span, "span_id")
                is_root = getattr(span, "is_segment")
                if is_root:
                    root_span_id = span_id
                if span_id not in span_tree:
                    spans_dict = span._asdict()
                    # Fallback to group_raw if group doesn't exist for now
                    spans_dict["key"] = (
                        spans_dict["op"]
                        if spans_dict["group"] == NULL_GROUP
                        else spans_dict["group"]
                    )
                    span_tree[span_id] = spans_dict
                    span_tree[span_id]["children"] = []

            for span_ in span_tree.values():
                parent_id = span_["parent_span_id"]
                if parent_id in span_tree:
                    parent_span = span_tree[parent_id]
                    children = parent_span["children"]
                    children.append(span_)

            if root_span_id in span_tree:
                root_span = span_tree[root_span_id]
                self.fingerprint_nodes(root_span, root_span["start_ms"])

        return self.aggregated_tree

    def fingerprint_nodes(
        self,
        span_tree,
        parent_timestamp,
        root_prefix=None,
        parent_node_fingerprint=None,
        nth_span=0,
    ):
        """
        Build a fingerprint using current span group and span groups of all the spans in the path before it.
        Example 1:
            A
            |--B
            |--C
               |--D

            In this example, given A, B, C, D are span groups, the fingerprint of span D would be
            the md5 hash of the value A-C-D.

        Example 2:
            A
            |--B
            |--C
            |  |--D
            |
            |--C
               |--E

            In this example, given A, B, C, D are span groups, the fingerprint of span D would be
            the md5 hash of the value A-C-D and for span E would be md5 hash of the value A-C1-E.
        """
        key = span_tree["key"]
        description = span_tree["description"]
        start_ms = span_tree["start_ms"]
        if root_prefix is None:
            prefix = key
        else:
            if nth_span == 1:
                prefix = f"{root_prefix}-{key}"
            else:
                prefix = f"{root_prefix}-{key}{nth_span}"
        node_fingerprint = hashlib.md5(prefix.encode()).hexdigest()[:16]
        parent_node = self.aggregated_tree.get(parent_node_fingerprint, None)

        if node_fingerprint in self.aggregated_tree:
            node = self.aggregated_tree[node_fingerprint]
            count = node["count()"]
            node["avg(exclusive_time)"] = incremental_average(
                node["avg(exclusive_time)"], count, span_tree["exclusive_time"]
            )
            node["avg(duration)"] = incremental_average(
                node["avg(duration)"], count, span_tree["duration"]
            )
            node["avg(relative_offset)"] = incremental_average(
                node["avg(relative_offset)"],
                count,
                start_ms - parent_timestamp,
            )
            # Calculates the absolute offset by the average offset of parent and average relative offset of current span from parent
            # so we can more accurately represent parent/child relationships in the span waterfall. ie, does a better job of ensuring
            # that child spans don't start before parent span at the aggregate level.
            node["avg(absolute_offset)"] = (
                parent_node["avg(absolute_offset)"] + node["avg(relative_offset)"]
                if parent_node
                else node["avg(relative_offset)"]
            )
            node["count()"] += 1
        else:
            self.aggregated_tree[node_fingerprint] = {
                "node_fingerprint": node_fingerprint,
                "parent_node_fingerprint": parent_node_fingerprint,
                "group": span_tree["group"],
                "op": span_tree["op"],
                "description": f"<<unparametrized>> {description}"
                if span_tree["group"] == NULL_GROUP
                else description,
                "start_ms": start_ms,
                "avg(exclusive_time)": span_tree["exclusive_time"],
                "avg(duration)": span_tree["duration"],
                "is_segment": span_tree["is_segment"],
                "avg(relative_offset)": start_ms - parent_timestamp,
                "avg(absolute_offset)": parent_node["avg(absolute_offset)"]
                + start_ms
                - parent_timestamp
                if parent_node
                else start_ms - parent_timestamp,
                "count()": 1,
            }

        # Handles sibling spans that have the same group
        span_tree["children"].sort(key=lambda s: s["start_ms"])
        span_hash_seen: Dict[str, int] = defaultdict(lambda: 0)

        for child in span_tree["children"]:
            child_span_hash = child["key"]
            span_hash_seen[child_span_hash] += 1
            self.fingerprint_nodes(
                child,
                span_tree["start_ms"],
                prefix,
                node_fingerprint,
                span_hash_seen[child_span_hash],
            )


@region_silo_endpoint
class OrganizationSpansAggregationEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:starfish-view", organization, actor=request.user):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        transaction = request.query_params.get("transaction", None)
        if transaction is None:
            return Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "Transaction not provided"}
            )

        builder = SpansIndexedQueryBuilder(
            dataset=Dataset.SpansIndexed,
            params=params,
            selected_columns=["transaction_id", "count()"],
            query=f"transaction:{transaction}",
            limit=100,
        )
        builder.columns.append(
            Function(
                "groupArray",
                parameters=[
                    Function(
                        "tuple",
                        parameters=[
                            Column("span_id"),
                            Column("is_segment"),
                            Column("parent_span_id"),
                            Column("group"),
                            Column("group_raw"),
                            Column("description"),
                            Column("op"),
                            Column("start_ms"),
                            Column("duration"),
                            Column("exclusive_time"),
                        ],
                    )
                ],
                alias="spans",
            )
        )
        snql_query = builder.get_snql_query()
        snql_query.tenant_ids = {"organization_id": organization.id}
        results = raw_snql_query(snql_query, Referrer.API_ORGANIZATION_SPANS_AGGREGATION.value)
        aggregated_tree = AggregateSpans().build_aggregate_span_tree(results)

        return Response(data=aggregated_tree)


def incremental_average(average, count, value):
    average += (value - average) / (count + 1)
    return average
