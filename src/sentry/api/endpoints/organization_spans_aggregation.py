import hashlib
from collections import defaultdict, namedtuple
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Set, Tuple, TypedDict

import sentry_sdk
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Function

from sentry import eventstore, features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.models.organization import Organization
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

ALLOWED_BACKENDS = ["indexedSpans", "nodestore"]

EventSpan = namedtuple(
    "EventSpan",
    [
        "span_id",
        "is_segment",
        "parent_span_id",
        "group",
        "description",
        "op",
        "start_timestamp",
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
        "start_timestamp": int,
        "start_ms": int,
        "avg(exclusive_time)": float,
        "avg(duration)": float,
        "is_segment": int,
        "avg(absolute_offset)": float,
        "avg(relative_offset)": float,
        "count()": int,
        "samples": Set[Tuple[Optional[str], str]],
    },
)

NULL_GROUP = "00"


class BaseAggregateSpans:
    def __init__(self) -> None:
        self.aggregated_tree: Dict[str, AggregateSpanRow] = {}
        self.current_transaction: Optional[str] = None

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
        start_timestamp = span_tree["start_timestamp_ms"]
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
                start_timestamp - parent_timestamp,
            )
            # Calculates the absolute offset by the average offset of parent and average
            # relative offset of current span from parent so we can more accurately
            # represent parent/child relationships in the span waterfall. ie, does
            # a better job of ensuring that child spans don't start before parent
            # span at the aggregate level.
            node["avg(absolute_offset)"] = (
                parent_node["avg(absolute_offset)"] + node["avg(relative_offset)"]
                if parent_node
                else node["avg(relative_offset)"]
            )
            node["count()"] += 1
            if len(node["samples"]) < 5:
                node["samples"].add((self.current_transaction, span_tree["span_id"]))
        else:
            sample = {(self.current_transaction, span_tree["span_id"])}
            self.aggregated_tree[node_fingerprint] = {
                "node_fingerprint": node_fingerprint,
                "parent_node_fingerprint": parent_node_fingerprint,
                "group": span_tree["group"],
                "op": span_tree["op"],
                "description": "" if span_tree["group"] == NULL_GROUP else span_tree["description"],
                "start_timestamp": start_timestamp,
                "start_ms": start_timestamp,  # TODO: Remove after updating frontend, duplicated for backward compatibility
                "avg(exclusive_time)": span_tree["exclusive_time"],
                "avg(duration)": span_tree["duration"],
                "is_segment": span_tree["is_segment"],
                "avg(relative_offset)": start_timestamp - parent_timestamp,
                "avg(absolute_offset)": parent_node["avg(absolute_offset)"]
                + start_timestamp
                - parent_timestamp
                if parent_node
                else start_timestamp - parent_timestamp,
                "count()": 1,
                "samples": sample,
            }

        # Handles sibling spans that have the same group
        span_tree["children"].sort(key=lambda s: s["start_timestamp_ms"])
        span_hash_seen: Dict[str, int] = defaultdict(lambda: 0)

        for child in span_tree["children"]:
            child_span_hash = child["key"]
            span_hash_seen[child_span_hash] += 1
            self.fingerprint_nodes(
                child,
                span_tree["start_timestamp_ms"],
                prefix,
                node_fingerprint,
                span_hash_seen[child_span_hash],
            )


class AggregateIndexedSpans(BaseAggregateSpans):
    def build_aggregate_span_tree(self, results: Mapping[str, Any]):
        for event in results["data"]:
            span_tree = {}
            root_span_id = None
            spans = event["spans"]

            self.current_transaction = event["transaction_id"]
            for span_ in spans:
                span = EventSpan(*span_)
                span_id = getattr(span, "span_id")
                is_root = getattr(span, "is_segment")
                if is_root:
                    root_span_id = span_id
                if span_id not in span_tree:
                    spans_dict = span._asdict()
                    # Fallback to op if group doesn't exist for now
                    spans_dict["key"] = (
                        spans_dict["op"]
                        if spans_dict["group"] == NULL_GROUP
                        else spans_dict["group"]
                    )
                    spans_dict["start_timestamp_ms"] = (
                        int(datetime.fromisoformat(spans_dict["start_timestamp"]).timestamp())
                        * 1000
                    ) + (spans_dict["start_ms"])
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
                self.fingerprint_nodes(root_span, root_span["start_timestamp_ms"])

        return self.aggregated_tree


class AggregateNodestoreSpans(BaseAggregateSpans):
    def build_aggregate_span_tree(self, results: Any):
        for event_ in results:
            event = event_.data.data
            span_tree = {}

            self.current_transaction = event["event_id"]
            root_span_id = event["contexts"]["trace"]["span_id"]
            span_tree[root_span_id] = {
                "span_id": root_span_id,
                "is_segment": True,
                "parent_span_id": None,
                "group": event["contexts"]["trace"]["hash"],
                "description": event["transaction"],
                "op": event["contexts"]["trace"]["op"],
                "start_timestamp_ms": event["start_timestamp"]
                * 1000,  # timestamp is unix timestamp, convert to ms
                "duration": (event["timestamp"] - event["start_timestamp"])
                * 1000,  # duration in ms
                "exclusive_time": event["contexts"]["trace"]["exclusive_time"],
                "key": event["contexts"]["trace"]["hash"],
                "children": [],
            }

            spans = event["spans"]

            for span in spans:
                span_id = span["span_id"]
                if span_id not in span_tree:
                    spans_dict = {
                        "span_id": span["span_id"],
                        "is_segment": False,
                        "parent_span_id": span["parent_span_id"],
                        "group": span.get("sentry_tags", {}).get("group")
                        or span.get("data", {}).get("span.group", NULL_GROUP),
                        "description": span.get("sentry_tags", {}).get("description", ""),
                        "op": span.get("op", ""),
                        "start_timestamp_ms": span["start_timestamp"]
                        * 1000,  # timestamp is unix timestamp, convert to ms
                        "duration": (span["timestamp"] - span["start_timestamp"])
                        * 1000,  # duration in ms
                        "exclusive_time": span["exclusive_time"],
                        "children": [],
                    }
                    # Fallback to op if group doesn't exist for now
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
                self.fingerprint_nodes(root_span, root_span["start_timestamp_ms"])

        return self.aggregated_tree


@region_silo_endpoint
class OrganizationSpansAggregationEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

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
        http_method = request.query_params.get("http.method", None)
        if transaction is None:
            return Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "Transaction not provided"}
            )

        backend = request.query_params.get("backend", "nodestore")
        if backend not in ALLOWED_BACKENDS:
            return Response(
                status=status.HTTP_400_BAD_REQUEST, data={"details": "Backend not supported"}
            )

        query = f"transaction:{transaction}"
        if http_method is not None:
            query += f" transaction.method:{http_method}"

        if backend == "indexedSpans":
            builder = SpansIndexedQueryBuilder(
                dataset=Dataset.SpansIndexed,
                params=params,
                selected_columns=["transaction_id", "count()"],
                query=query,
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
                                Column("description"),
                                Column("op"),
                                Column("start_timestamp"),
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

            with sentry_sdk.start_span(
                op="span.aggregation", description="AggregateIndexedSpans.build_aggregate_span_tree"
            ):
                aggregated_tree = AggregateIndexedSpans().build_aggregate_span_tree(results)

            return Response(data=aggregated_tree)

        conditions = [["transaction", "=", transaction]]
        if http_method is not None:
            conditions.append(["http.method", "=", http_method])

        environments = params.get("environment", None)
        if environments and len(environments) > 1:
            conditions.append(["environment", "IN", environments])
        elif environments and len(environments) == 1:
            conditions.append(["environment", "=", environments[0]])

        events = eventstore.backend.get_events(
            filter=eventstore.Filter(
                conditions=conditions,
                start=params["start"],
                end=params["end"],
                project_ids=params["project_id"],
                organization_id=params["organization_id"],
            ),
            limit=100,
            referrer=Referrer.API_ORGANIZATION_SPANS_AGGREGATION.value,
            dataset=Dataset.Transactions,
            tenant_ids={"organization_id": organization.id},
        )

        with sentry_sdk.start_span(
            op="span.aggregation", description="AggregateNodestoreSpans.build_aggregate_span_tree"
        ):
            aggregated_tree = AggregateNodestoreSpans().build_aggregate_span_tree(events)

        return Response(data=aggregated_tree)


def incremental_average(average, count, value):
    average += (value - average) / (count + 1)
    return average
