import hashlib
from collections import defaultdict, namedtuple
from typing import Dict, List, TypedDict

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
        "start_ms": int,
        "avg(exclusive_time)": float,
        "avg(duration)": float,
        "is_segment": int,
        "avg(offset)": float,
        "count()": int,
    },
)

NULL_GROUP = "00"


@region_silo_endpoint
class OrganizationSpansAggregationEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    aggregated_tree: Dict[str, AggregateSpanRow] = {}

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:starfish-aggregate-span-waterfall", organization, actor=request.user
        ):
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
                    spans_dict["coalesced_group"] = (
                        spans_dict["group_raw"]
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

        return Response(data=self.aggregated_tree)

    def fingerprint_nodes(
        self,
        span_tree,
        root_start_timestamp,
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
        coalesced_group = span_tree["coalesced_group"]
        description = span_tree["description"]
        start_ms = span_tree["start_ms"]
        if root_prefix is None:
            prefix = coalesced_group
        else:
            if nth_span == 1:
                prefix = f"{root_prefix}-{coalesced_group}"
            else:
                prefix = f"{root_prefix}-{coalesced_group}{nth_span}"
        node_fingerprint = hashlib.md5(prefix.encode()).hexdigest()[:16]

        if node_fingerprint in self.aggregated_tree:
            node = self.aggregated_tree[node_fingerprint]
            count = node["count()"]
            node["avg(exclusive_time)"] = incremental_average(
                node["avg(exclusive_time)"], count, span_tree["exclusive_time"]
            )
            node["avg(duration)"] = incremental_average(
                node["avg(duration)"], count, span_tree["duration"]
            )
            node["avg(offset)"] = incremental_average(
                node["avg(offset)"],
                count,
                start_ms - root_start_timestamp,
            )
            node["count()"] += 1
        else:
            self.aggregated_tree[node_fingerprint] = {
                "node_fingerprint": node_fingerprint,
                "parent_node_fingerprint": parent_node_fingerprint,
                "group": span_tree["group"],
                "description": description,
                "start_ms": start_ms,
                "avg(exclusive_time)": span_tree["exclusive_time"],
                "avg(duration)": span_tree["duration"],
                "is_segment": span_tree["is_segment"],
                "avg(offset)": start_ms
                - root_start_timestamp,  # offset of the span relative to the start timestamp of the root span
                "count()": 1,
            }

        # Handles sibling spans that have the same group
        span_tree["children"].sort(key=lambda s: s["start_ms"])
        span_hash_seen: Dict[str, int] = defaultdict(lambda: 0)

        for child in span_tree["children"]:
            child_span_hash = child["coalesced_group"]
            span_hash_seen[child_span_hash] += 1
            self.fingerprint_nodes(
                child,
                root_start_timestamp,
                prefix,
                node_fingerprint,
                span_hash_seen[child_span_hash],
            )


def incremental_average(average, count, value):
    average += (value - average) / (count + 1)
    return average
