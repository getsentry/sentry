import logging
from collections import OrderedDict, defaultdict, deque

import sentry_sdk
from django.http import Http404
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from sentry import eventstore, features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.serializers.models.event import get_tags_with_meta
from sentry.snuba import discover
from sentry.utils.validators import INVALID_EVENT_DETAILS, is_event_id

logger = logging.getLogger(__name__)
MAX_TRACE_SIZE = 100
NODESTORE_KEYS = ["timestamp", "start_timestamp"]
ERROR_COLUMNS = [
    "id",
    "project",
    "timestamp",
    "trace.span",
    "transaction",
    "issue",
    "title",
    "tags[level]",
]


def find_event(items, function, default=None):
    return next(filter(function, items), default)


def is_root(item):
    return item.get("root", "0") == "1"


def child_sort_key(item):
    return [item["start_timestamp"], item["timestamp"]]


class OrganizationEventsTraceEndpointBase(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:trace-view-quick", organization, actor=request.user
        ) or features.has("organizations:trace-view-summary", organization, actor=request.user)

    def serialize_event(self, event, parent, generation=None):
        return {
            "event_id": event["id"],
            "span_id": event["trace.span"],
            "transaction": event["transaction"],
            "transaction.duration": event["transaction.duration"],
            "transaction.op": event["transaction.op"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "parent_event_id": parent,
            # Avoid empty string for root events
            "parent_span_id": event["trace.parent_span"] or None,
            # Can be None on the light trace when we don't know the parent
            "generation": generation,
            "errors": [],
        }

    def serialize_error(self, event):
        return {
            "event_id": event["id"],
            "issue_id": event["issue.id"],
            "span": event["trace.span"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "title": event["title"],
            "level": event["tags[level]"],
        }

    def construct_span_map(self, events, key):
        """A mapping of span ids to their events

        key depends on the event type:
        - Errors are associated to transactions via span_id
        - Transactions are associated to each other via parent_span_id
        """
        parent_map = defaultdict(list)
        for item in events:
            if not is_root(item):
                parent_map[item[key]].append(item)
        return parent_map

    def get(self, request, organization, trace_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        detailed = request.GET.get("detailed", "0") == "1"
        event_id = request.GET.get("event_id")

        # Only need to validate event_id as trace_id is validated in the URL
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_EVENT_DETAILS.format("Event")}, status=400)

        # selected_columns is a set list, since we only want to include the minimum to render the trace
        selected_columns = [
            "id",
            "timestamp",
            "transaction.duration",
            "transaction.op",
            "transaction",
            # project gets the slug, and project.id gets added automatically
            "project",
            "trace.span",
            "trace.parent_span",
            'to_other(trace.parent_span, "", 0, 1) AS root',
        ]
        # but if we're getting the detailed view load some extra columns
        if detailed:
            # TODO(wmak): Move op and timestamp here once we pass detailed for trace summary
            selected_columns += [
                "transaction.status",
            ]

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=selected_columns,
                # We want to guarantee at least getting the root, and hopefully events near it with timestamp
                # id is just for consistent results
                orderby=["-root", "-timestamp", "id"],
                params=params,
                query=f"event.type:transaction trace:{trace_id}",
                limit=MAX_TRACE_SIZE,
                referrer="api.trace-view.get-ids",
            )
            if len(result["data"]) == 0:
                return Response(status=404)
            len_transactions = len(result["data"])
            sentry_sdk.set_tag("trace_view.num_transactions", len_transactions)
            sentry_sdk.set_tag(
                "trace_view.num_transactions.grouped",
                "<10" if len_transactions < 10 else "<100" if len_transactions < 100 else ">100",
            )

        warning_extra = {"trace": trace_id, "organization": organization}

        root = result["data"][0] if is_root(result["data"][0]) else None

        # Look for extra roots
        extra_roots = 0
        for item in result["data"][1:]:
            if is_root(item):
                extra_roots += 1
            else:
                break
        if extra_roots > 0:
            sentry_sdk.set_tag("discover.trace-view.warning", "root.extra-found")
            logger.warning(
                "discover.trace-view.root.extra-found",
                {"extra_roots": extra_roots, **warning_extra},
            )

        current_transaction = find_event(result["data"], lambda t: t["id"] == event_id)
        errors = self.get_errors(organization, trace_id, params, current_transaction, event_id)

        return Response(
            self.serialize(result["data"], errors, root, warning_extra, event_id, detailed)
        )


class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    def get_current_transaction(self, transactions, errors, event_id):
        """Given an event_id return the related transaction event

        The event_id could be for an error, since we show the quick-trace
        for both event types
        We occasionally have to get the nodestore data, so this function returns
        the nodestore event as well so that we're doing that in one location.
        """
        transaction_event = find_event(transactions, lambda item: item["id"] == event_id)
        if transaction_event is not None:
            return transaction_event, eventstore.get_event_by_id(
                transaction_event["project.id"], transaction_event["id"]
            )

        # The event couldn't be found, it might be an error
        error_event = find_event(errors, lambda item: item["id"] == event_id)
        # Alright so we're looking at an error, time to see if we can find its transaction
        if error_event:
            # Unfortunately the only association from an event back to its transaction is name & span_id
            # First maybe we got lucky and the error happened on the transaction's "span"
            transaction_event = find_event(
                transactions, lambda item: item["trace.span"] == error_event["trace.span"]
            )
            if transaction_event:
                return transaction_event, eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
            # We didn't get lucky, time to talk to nodestore...
            for transaction_event in transactions:
                if transaction_event["transaction"] != error_event["transaction"]:
                    continue

                nodestore_event = eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
                for span in nodestore_event.data.get("spans", []):
                    if span["span_id"] == error_event["trace.span"]:
                        return transaction_event, nodestore_event

        # The current event couldn't be found in errors or transactions
        raise Http404()

    def get_errors(self, organization, trace_id, params, current_event, event_id):
        """Get errors for this trace

        We try to optimize the light view's error retrieval, compared to
        the full trace, so we try to get as few errors as possible
        """
        with sentry_sdk.start_span(op="discover", description="getting trace errors"):
            with self.handle_query_errors():
                # Search for errors for the current event if its a transaction, otherwise look for the exact error
                query_extra = (
                    f"transaction:{current_event['transaction']}"
                    if current_event
                    else f"id:{event_id}"
                )
                # This can't be combined with the transaction query since we need dataset specific fields
                error_results = discover.query(
                    selected_columns=ERROR_COLUMNS,
                    orderby=["-timestamp", "id"],
                    params=params,
                    query=f"!event.type:transaction trace:{trace_id} {query_extra}",
                    limit=MAX_TRACE_SIZE,
                    auto_fields=False,
                    referrer="api.trace-view.get-errors-light",
                )
                return error_results["data"]

    def serialize(
        self,
        transactions,
        errors,
        root,
        warning_extra,
        event_id,
        detailed=False,
    ):
        """ Because the light endpoint could potentially have gaps between root and event we return a flattened list """
        snuba_event, nodestore_event = self.get_current_transaction(transactions, errors, event_id)
        parent_map = self.construct_span_map(transactions, "trace.parent_span")
        error_map = self.construct_span_map(errors, "trace.span")
        trace_results = []
        current_generation = None

        with sentry_sdk.start_span(op="building.trace", description="light trace"):
            # We might not be necessarily connected to the root if we're on an orphan event
            if root is not None and root["id"] != snuba_event["id"]:
                # Get the root event and see if the current event's span is in the root event
                root_event = eventstore.get_event_by_id(root["project.id"], root["id"])
                root_span = find_event(
                    root_event.data.get("spans", []),
                    lambda item: item["span_id"] == snuba_event["trace.parent_span"],
                )

                # For the light response, the parent will be unknown unless it is a direct descendent of the root
                is_root_child = root_span is not None
                # We only know to add the root if its the direct parent
                if is_root_child:
                    trace_results.append(
                        self.serialize_event(
                            root,
                            None,
                            0,
                        )
                    )
                    current_generation = 1
            else:
                is_root_child = False
                if root is not None and root["id"] == snuba_event["id"]:
                    current_generation = 0

            current_event = self.serialize_event(
                snuba_event, root["id"] if is_root_child else None, current_generation
            )
            trace_results.append(current_event)

            spans = nodestore_event.data.get("spans", [])
            # Need to include the transaction as a span as well
            spans.append({"span_id": snuba_event["trace.span"]})

            for span in spans:
                if span["span_id"] in error_map:
                    current_event["errors"].extend(
                        [self.serialize_error(error) for error in error_map.pop(span["span_id"])]
                    )
                if span["span_id"] in parent_map:
                    child_events = parent_map.pop(span["span_id"])
                    trace_results.extend(
                        [
                            self.serialize_event(
                                child_event,
                                snuba_event["id"],
                                (
                                    current_event["generation"] + 1
                                    if current_event["generation"] is not None
                                    else None
                                ),
                            )
                            for child_event in child_events
                        ]
                    )

        return trace_results


class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    def get_errors(self, organization, trace_id, params, *args):
        """ Ignores current_event since we get all errors """
        with sentry_sdk.start_span(op="discover", description="getting trace errors"):
            with self.handle_query_errors():
                # This can't be combined with the transaction query since we need dataset specific fields
                error_results = discover.query(
                    selected_columns=ERROR_COLUMNS,
                    orderby=["-timestamp", "id"],
                    params=params,
                    query=f"!event.type:transaction trace:{trace_id}",
                    limit=MAX_TRACE_SIZE,
                    auto_fields=False,
                    referrer="api.trace-view.get-errors",
                )
                return error_results["data"]

    def serialize_event(self, event, *args, **kwargs):
        result = super().serialize_event(event, *args, **kwargs)
        if "transaction.status" in event:
            result.update(
                {
                    "transaction.status": SPAN_STATUS_CODE_TO_NAME.get(
                        event["transaction.status"], "unknown"
                    ),
                }
            )
        result.update(
            {
                "children": [],
            }
        )
        return result

    def update_nodestore_extra(self, event, nodestore_event, detailed=False):
        """ Add extra data that we get from Nodestore """
        event.update(
            {event_key: nodestore_event.data.get(event_key) for event_key in NODESTORE_KEYS}
        )
        if detailed:
            if "measurements" in nodestore_event.data:
                event["measurements"] = nodestore_event.data.get("measurements")
            event["_meta"] = {}
            event["tags"], event["_meta"]["tags"] = get_tags_with_meta(nodestore_event)

    def update_children(self, event):
        """Updates the childrens of subtraces

        - Generation could be incorrect from orphans where we've had to reconnect back to an orphan event that's
          already been encountered
        - Sorting children events by timestamp
        """
        parents = [event]
        iteration = 0
        while parents and iteration < MAX_TRACE_SIZE:
            iteration += 1
            parent = parents.pop()
            parent["children"].sort(key=child_sort_key)
            for child in parent["children"]:
                child["generation"] = parent["generation"] + 1
                parents.append(child)

    def serialize(
        self,
        transactions,
        errors,
        root,
        warning_extra,
        event_id,
        detailed=False,
    ):
        """ For the full event trace, we return the results as a graph instead of a flattened list """
        parent_map = self.construct_span_map(transactions, "trace.parent_span")
        error_map = self.construct_span_map(errors, "trace.span")
        parent_events = {}
        # TODO(3.7): Dictionary ordering in py3.6 is an implementation detail, using an OrderedDict because this way
        # we try to guarantee in py3.6 that the first item is the root.  We can switch back to a normal dict when we're
        # on python 3.7.
        results_map = OrderedDict()
        to_check = deque()
        if root:
            parent_events[root["id"]] = self.serialize_event(root, None, 0)
            results_map[None] = [parent_events[root["id"]]]
            to_check.append(root)

        with sentry_sdk.start_span(op="building.trace", description="full trace"):
            iteration = 0
            has_orphans = False
            while parent_map or to_check:
                if len(to_check) == 0:
                    has_orphans = True
                    # Grab any set of events from the parent map
                    parent_span_id, current_events = parent_map.popitem()

                    current_event, *siblings = current_events
                    # If there were any siblings put them back
                    if siblings:
                        parent_map[parent_span_id] = siblings

                    previous_event = parent_events[current_event["id"]] = self.serialize_event(
                        current_event, None, 0
                    )

                    # not using a defaultdict here as a DefaultOrderedDict isn't worth the effort
                    if parent_span_id in results_map:
                        results_map[parent_span_id].append(previous_event)
                    else:
                        results_map[parent_span_id] = [previous_event]
                else:
                    current_event = to_check.popleft()
                    previous_event = parent_events[current_event["id"]]

                # This is faster than doing a call to get_events, since get_event_by_id only makes a call to snuba
                # when non transaction events are included.
                with sentry_sdk.start_span(op="nodestore", description="get_event_by_id"):
                    nodestore_event = eventstore.get_event_by_id(
                        current_event["project.id"], current_event["id"]
                    )

                self.update_nodestore_extra(previous_event, nodestore_event, detailed)

                spans = nodestore_event.data.get("spans", [])
                # Need to include the transaction as a span as well
                spans.append({"span_id": previous_event["span_id"]})

                for child in spans:
                    if child["span_id"] in error_map:
                        previous_event["errors"].extend(
                            [
                                self.serialize_error(error)
                                for error in error_map.pop(child["span_id"])
                            ]
                        )
                    # We need to connect back to an existing orphan trace
                    if has_orphans and child["span_id"] in results_map:
                        orphan_subtraces = results_map.pop(child["span_id"])
                        for orphan_subtrace in orphan_subtraces:
                            orphan_subtrace["parent_event_id"] = previous_event["event_id"]
                        previous_event["children"].extend(orphan_subtraces)
                    if child["span_id"] not in parent_map:
                        continue
                    # Avoid potential span loops by popping, so we don't traverse the same nodes twice
                    child_events = parent_map.pop(child["span_id"])

                    for child_event in child_events:
                        parent_events[child_event["id"]] = self.serialize_event(
                            child_event, current_event["id"], previous_event["generation"] + 1
                        )
                        # Add this event to its parent's children
                        previous_event["children"].append(parent_events[child_event["id"]])

                        to_check.append(child_event)
                # Limit iterations just to be safe
                iteration += 1
                if iteration > MAX_TRACE_SIZE:
                    sentry_sdk.set_tag("discover.trace-view.warning", "surpassed-trace-limit")
                    logger.warning(
                        "discover.trace-view.surpassed-trace-limit",
                        extra=warning_extra,
                    )
                    break

        root_traces = []
        orphans = []
        for index, result in enumerate(results_map.values()):
            for subtrace in result:
                self.update_children(subtrace)
            if index > 0 or root is None:
                orphans.extend(result)
            elif root:
                root_traces = result
        # We sort orphans and roots separately because we always want the root(s) as the first element(s)
        root_traces.sort(key=child_sort_key)
        orphans.sort(key=child_sort_key)
        return root_traces + orphans


class OrganizationEventsTraceMetaEndpoint(OrganizationEventsTraceEndpointBase):
    def get(self, request, organization, trace_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace meta isn't useful without global views, so skipping the check here
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=[
                    "count_unique(project_id) as projects",
                    "count_if(event.type, equals, transaction) as transactions",
                    "count_if(event.type, notEquals, transaction) as errors",
                ],
                params=params,
                query=f"trace:{trace_id}",
                limit=1,
                referrer="api.trace-view.get-meta",
            )
            if len(result["data"]) == 0:
                return Response(status=404)
        return Response(self.serialize(result["data"][0]))

    def serialize(self, results):
        return {
            # Values can be null if there's no result
            "projects": results.get("projects") or 0,
            "transactions": results.get("transactions") or 0,
            "errors": results.get("errors") or 0,
        }
